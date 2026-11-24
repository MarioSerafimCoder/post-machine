import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import models from '../src/features/images/semanticModels.json' with { type: 'json' }

const names = process.argv.slice(2)
const partSize = 20_000_000
if (!names.length || names.some(name => !Object.hasOwn(models, name))) {
  throw Error('Uso: node benchmarks/prepare-models.mjs clip [siglip2]')
}

for (const name of names) {
  const { files, revision, repository } = models[name]
  const destination = new URL(`./.cache/models/${name}/${revision}/`, import.meta.url)
  await mkdir(destination, { recursive: true })
  for (const [key, [path, size]] of Object.entries(files)) {
    const parts = Array.from({ length: Math.ceil(size / partSize) }, (_, index) => new URL(`${key}.${index}.bin`, destination))
    const sizes = parts.map((_, index) => Math.min(partSize, size - index * partSize))
    const existing = await Promise.all(parts.map(part => stat(part).then(info => info.size, () => 0)))
    if (existing.every((bytes, index) => bytes === sizes[index])) continue
    const cache = process.env.PM_MODEL_ROOT && join(process.env.PM_MODEL_ROOT, name, basename(path))
    const cached = cache && await stat(cache).then(info => info.size === size, () => false)
    const response = cached ? null : await fetch(`https://huggingface.co/${repository}/resolve/${revision}/${path}?download=true`)
    if (response && (!response.ok || !response.body)) throw Error(`Download de ${name}/${path}: ${response.status}`)
    const stream = response ? Readable.fromWeb(response.body) : createReadStream(cache)
    const source = stream[Symbol.asyncIterator]()
    let pending = Buffer.alloc(0)
    for (const [index, part] of parts.entries()) {
      async function* readPart() {
        let remaining = sizes[index]
        while (remaining > 0) {
          if (!pending.length) {
            const next = await source.next()
            if (next.done) throw Error(`Arquivo incompleto: ${name}/${path}`)
            pending = next.value
          }
          const bytes = Math.min(remaining, pending.length)
          yield pending.subarray(0, bytes)
          pending = pending.subarray(bytes)
          remaining -= bytes
        }
      }
      await pipeline(Readable.from(readPart()), createWriteStream(part))
    }
    if (pending.length || !(await source.next()).done) throw Error(`Tamanho inesperado: ${name}/${path}`)
    console.log(`${name}/${key}: ${size} bytes em ${parts.length} arquivo(s)`)
  }
}

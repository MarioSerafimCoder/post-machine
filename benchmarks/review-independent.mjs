import { readFile, writeFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const cache = new URL('./.cache/', import.meta.url)
const prefix = process.argv.find(arg => arg.startsWith('--prefix='))?.slice(9) ?? 'independent'
const rows = JSON.parse(await readFile(new URL(prefix + '-network.json', cache), 'utf8'))
const sheet = createCanvas(1200, 1500)
const draw = sheet.getContext('2d')
draw.fillStyle = 'white'
draw.fillRect(0, 0, sheet.width, sheet.height)
draw.font = '13px Arial'
async function imageFor(row) {
  for (const candidate of row.candidates ?? []) {
    const start = performance.now()
    try {
      const response = await fetch(candidate.url, { redirect: 'error', signal: AbortSignal.timeout(4200) })
      if (!response.ok || !response.body || !/^image\/(?:jpeg|png|webp)\b/.test(response.headers.get('content-type') ?? '')) {
        await response.body?.cancel()
        continue
      }
      const chunks = []
      let length = 0
      for await (const chunk of response.body) {
        length += chunk.length
        if (length > 10_000_000) throw Error('raster_limit')
        chunks.push(chunk)
      }
      const image = await loadImage(Buffer.concat(chunks))
      if (Math.min(image.width, image.height) < 480 || image.width * image.height > 40_000_000) continue
      return { image, url: candidate.url, source: candidate.page, caption: candidate.caption, classification: candidate.fit.match.classification,
        downloadMs: performance.now() - start }
    } catch { /* Keep the next candidate available. */ }
  }
}
const selected = []
for (let offset = 0; offset < rows.length; offset += 3) {
  const block = rows.slice(offset, offset + 3)
  const results = await Promise.all(block.map(imageFor))
  for (const [i, row] of block.entries()) {
    const index = offset + i
    const x = (index % 4) * 300
    const y = Math.floor(index / 4) * 185
    draw.fillStyle = '#111'
    draw.fillText(index + ' ' + (row.title ?? row.topic).slice(0, 43), x + 6, y + 17)
    const result = results[i]
    if (!result) { selected.push({ index, missing: true }); continue }
    const { image, ...credit } = result
    const scale = Math.min(282 / image.width, 150 / image.height)
    draw.drawImage(image, x + 6, y + 24, image.width * scale, image.height * scale)
    selected.push({ index, ...credit })
  }
}
await writeFile(new URL(prefix + '-contact.jpg', cache), sheet.toBuffer('image/jpeg'))
await writeFile(new URL(prefix + '-selection.json', cache), JSON.stringify(selected, null, 2))
console.log(JSON.stringify({ downloaded: selected.filter(row => row.url).length, missing: selected.filter(row => row.missing).length }))

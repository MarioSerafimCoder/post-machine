import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import semanticModels from './src/features/images/semanticModels.json' with { type: 'json' }

const visualWithoutWorker: Plugin = {
  name: 'visual-without-worker',
  configureServer(server) { server.middlewares.use('/api/visual', unavailable) },
  configurePreviewServer(server) { server.middlewares.use('/api/visual', unavailable) },
}
function unavailable(_request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) {
  response.setHeader('content-type', 'application/json')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify({ state: 'disabled', candidates: [] }))
}
const resolveDependency = createRequire(import.meta.url).resolve
const languages = ['eng', 'por'] as const
const trainedData = (language: typeof languages[number]) => resolveDependency(`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`)
const partSize = 20_000_000
const modelFiles = Object.entries(semanticModels).flatMap(([name, { revision, files }]) => Object.entries(files).flatMap(([file, [, size]]) =>
  Array.from({ length: Math.ceil(Number(size) / partSize) }, (_, index) => {
    const path = `${name}/${revision}/${file}.${index}.bin`
    return { model: name, path, source: new URL('./benchmarks/.cache/models/' + path, import.meta.url),
      bytes: Math.min(partSize, Number(size) - index * partSize) }
  })))
function localVisualModels(): Plugin {
  let ocr = false
  let clip = false
  return {
    name: 'local-visual-models',
    configResolved(config) {
      ocr = config.env.VITE_VISUAL_OCR === 'true'
      clip = config.env.VITE_VISUAL_SEMANTIC === 'clip'
    },
    configureServer(server) {
      server.middlewares.use('/visual-ocr', (request, response, next) => {
        const language = languages.find(item => request.url === `/${item}.traineddata.gz`)
        if (!language) return next()
        void readFile(trainedData(language)).then(data => {
          response.setHeader('content-type', 'application/octet-stream')
          response.end(data)
        }, next)
      })
      server.middlewares.use('/visual-models', (request, response, next) => {
        const file = modelFiles.find(item => request.url === '/' + item.path)
        if (!file) return next()
        void readFile(file.source).then(data => {
          response.setHeader('content-type', 'application/octet-stream')
          response.setHeader('content-length', data.byteLength)
          response.end(data)
        }, () => { response.statusCode = 404; response.end() })
      })
    },
    async generateBundle() {
      if (clip) {
        for (const file of modelFiles.filter(item => item.model === 'clip')) {
          const source = await readFile(file.source).catch(() => { throw Error('Prepare o CLIP com node benchmarks/prepare-models.mjs clip.') })
          if (source.byteLength !== file.bytes) throw Error('Peso local incompleto: ' + file.path)
          this.emitFile({ type: 'asset', fileName: 'visual-models/' + file.path, source })
        }
        this.emitFile({ type: 'asset', fileName: 'licenses/Tokenizers-LICENSE.txt',
          source: await readFile(resolve(dirname(resolveDependency('@huggingface/tokenizers')), '../LICENSE')) })
        this.emitFile({ type: 'asset', fileName: 'licenses/CLIP-LICENSE.txt',
          source: await readFile(new URL('./benchmarks/licenses/CLIP.txt', import.meta.url)) })
      }
      if (!ocr) return
      for (const language of languages) this.emitFile({ type: 'asset', fileName: `visual-ocr/${language}.traineddata.gz`,
        source: await readFile(trainedData(language)) })
      for (const [name, license] of [['Tesseract.js', 'tesseract.js/LICENSE.md'], ['Tesseract.js-core', 'tesseract.js-core/LICENSE'],
        ['Tesseract.js-worker', 'tesseract.js/dist/worker.min.js.LICENSE.txt']]) {
        this.emitFile({ type: 'asset', fileName: `licenses/${name}-LICENSE.txt`, source: await readFile(resolveDependency(license)) })
      }
      this.emitFile({ type: 'asset', fileName: 'licenses/Tessdata-LICENSE.txt',
        source: await readFile(new URL('./benchmarks/licenses/Tessdata.txt', import.meta.url)) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), visualWithoutWorker, localVisualModels()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.{ts,tsx}'] },
})

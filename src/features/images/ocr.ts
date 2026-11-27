import type Tesseract from 'tesseract.js'
import tesseract from 'tesseract.js/dist/tesseract.esm.min.js?url'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'

async function prepareRaster(file: Blob, signal: AbortSignal) {
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(file)
  try {
    signal.throwIfAborted()
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const context = canvas.getContext('2d')
    if (!context) throw Error('Canvas indisponível.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvas.convertToBlob()
  } finally { bitmap.close() }
}

type Reading = { text: string; confidence: number }
const readings = new Map<string, Reading>()
let active = false
export async function readVisualTexts(files: { key: string; file: Blob }[], language: 'eng' | 'por', signal: AbortSignal,
  receive: (key: string, reading: Reading) => void) {
  signal.throwIfAborted()
  const missing = files.filter(({ key }) => {
    const reading = readings.get(language + ':' + key)
    if (reading) receive(key, reading)
    return !reading
  })
  if (!missing.length || active) return
  active = true
  try { await recognize(missing.slice(0, 3), language, signal, receive) }
  finally { active = false }
}

async function recognize(missing: { key: string; file: Blob }[], language: 'eng' | 'por', signal: AbortSignal,
  receive: (key: string, reading: Reading) => void) {
  const { default: { createWorker, OEM, PSM } } = await import(/* @vite-ignore */ tesseract) as { default: typeof Tesseract }
  signal.throwIfAborted()
  let interrupt!: (reason: unknown) => void
  const interrupted = new Promise<never>((_, reject) => { interrupt = reject })
  const onAbort = () => interrupt(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  const session = createWorker(language, OEM.LSTM_ONLY, {
    workerPath, corePath, workerBlobURL: false, cachePath: 'post-machine-ocr-best-int-v1',
    langPath: new URL('/visual-ocr/', location.origin).href,
    errorHandler: (cause: unknown) => interrupt(Error(String(cause))),
  })
  try {
    const worker = await Promise.race([session, interrupted])
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }), interrupted])
    for (const { key, file } of missing) {
      const preview = await Promise.race([prepareRaster(file, signal), interrupted])
      const { data } = await Promise.race([worker.recognize(preview), interrupted])
      const reading = { text: data.text.slice(0, 1000), confidence: data.confidence }
      readings.set(language + ':' + key, reading)
      if (readings.size > 32) readings.delete(readings.keys().next().value!)
      receive(key, reading)
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    void session.then(worker => worker.terminate(), () => undefined)
  }
}

export async function readVisualText(file: Blob, language: 'eng' | 'por', signal: AbortSignal) {
  const key = crypto.randomUUID()
  let result: Reading | undefined
  await readVisualTexts([{ key, file }], language, signal, (_key, reading) => { result = reading })
  return result ?? { text: '', confidence: 0 }
}

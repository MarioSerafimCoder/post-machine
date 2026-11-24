import type Tesseract from 'tesseract.js'
import tesseract from 'tesseract.js/dist/tesseract.esm.min.js?url'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'

export async function readVisualText(file: Blob, language: 'eng' | 'por', signal: AbortSignal) {
  const { default: { createWorker, OEM, PSM } } = await import(/* @vite-ignore */ tesseract) as { default: typeof Tesseract }
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(file)
  let preview: Blob
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const context = canvas.getContext('2d')
    if (!context) throw Error('Canvas indisponível.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    preview = await canvas.convertToBlob()
  } finally { bitmap.close() }
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
    const { data } = await Promise.race([worker.recognize(preview), interrupted])
    return { text: data.text.slice(0, 1000), confidence: data.confidence }
  } finally {
    signal.removeEventListener('abort', onAbort)
    void session.then(worker => worker.terminate(), () => undefined)
  }
}

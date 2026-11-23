import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import model from './mobilenetv2-12-int8.onnx?url'
import { contrastFocalPoint, cueFromScores } from './signals'
import type { VisionMessage, VisionPhoto } from './types'

env.wasm.numThreads = 1
env.wasm.proxy = false
env.wasm.wasmPaths = { wasm: new URL(wasm, self.location.href).href }
const send = (message: VisionMessage) => self.postMessage(message)
const size = 224
const mean = [.485, .456, .406]
const deviation = [.229, .224, .225]
let session: Promise<InferenceSession> | undefined

async function analyze(runtime: InferenceSession, file: Blob) {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 64 / Math.max(bitmap.width, bitmap.height))
    const small = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const smallContext = small.getContext('2d', { willReadFrequently: true })!
    smallContext.drawImage(bitmap, 0, 0, small.width, small.height)
    const focalPoint = contrastFocalPoint(smallContext.getImageData(0, 0, small.width, small.height).data, small.width, small.height)
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const crop = Math.min(bitmap.width, bitmap.height) * size / 256
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    const plane = size * size
    const input = new Float32Array(3 * plane)
    for (let pixel = 0; pixel < plane; pixel++) for (let channel = 0; channel < 3; channel++) {
      input[channel * plane + pixel] = (data[pixel * 4 + channel] / 255 - mean[channel]) / deviation[channel]
    }
    const tensor = new Tensor('float32', input, [1, 3, size, size])
    try {
      const outputs = await runtime.run({ [runtime.inputNames[0]]: tensor })
      const output = outputs[runtime.outputNames[0]]
      try {
        if (!(output.data instanceof Float32Array) || output.data.length !== 1000) throw Error('Saída de classificação incompatível.')
        return { cue: cueFromScores(output.data), focalPoint }
      } finally { Object.values(outputs).forEach(value => value.dispose()) }
    } finally { tensor.dispose() }
  } finally { bitmap.close() }
}

self.onmessage = async (event: MessageEvent<VisionPhoto[]>) => {
  try {
    session ??= InferenceSession.create(new URL(model, self.location.href).href, { executionProviders: ['wasm'] })
    const runtime = await session
    for (const photo of event.data) {
      try { send({ type: 'result', id: photo.id, analysis: await analyze(runtime, photo.file) }) }
      catch { send({ type: 'photo-error', id: photo.id }) }
    }
    send({ type: 'complete' })
  } catch {
    send({ type: 'error', message: 'O navegador não conseguiu carregar a análise visual local.' })
  }
}

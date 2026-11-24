import { Tokenizer } from '@huggingface/tokenizers'
import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import models from './semanticModels.json'
import type { SemanticRequest } from './semanticClient'

env.wasm.numThreads = 1
env.wasm.proxy = false
env.wasm.wasmPaths = { wasm: new URL(wasm, self.location.href).href }

type Model = keyof typeof models
type ModelFile = keyof typeof models.clip.files
const partSize = 20_000_000
const cacheName = 'post-machine-visual-models-v1'

async function modelFile(model: Model, file: ModelFile) {
  const { revision, files } = models[model]
  const [, size] = files[file]
  const bytes = new Uint8Array(Number(size))
  const cache = await caches.open(cacheName).catch(() => undefined)
  for (let offset = 0; offset < bytes.length; offset += partSize) {
    const path = new URL(`/visual-models/${model}/${revision}/${file}.${offset / partSize}.bin`, self.location.origin)
    const local = await cache?.match(path.href).catch(() => undefined)
    const response = local ?? await fetch(path, { redirect: 'error' })
    const length = Math.min(partSize, bytes.length - offset)
    if (!response.ok || response.headers.get('content-type')?.includes('text/html') ||
        Number(response.headers.get('content-length')) > length) throw Error('Pesos locais indisponíveis.')
    const part = new Uint8Array(await response.arrayBuffer())
    if (part.length !== length) throw Error('Arquivo do modelo incompleto.')
    bytes.set(part, offset)
    if (!local && cache) void cache.put(path.href, new Response(part)).catch(() => undefined)
  }
  return bytes
}

async function load(name: Model) {
  const parameters = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' } as const
  const json = async (file: 'tokenizer' | 'config') => JSON.parse(new TextDecoder().decode(await modelFile(name, file)))
  const tokenizer = new Tokenizer(await json('tokenizer'), await json('config'))
  const text = await InferenceSession.create(await modelFile(name, 'text'), parameters)
  try {
    const vision = await InferenceSession.create(await modelFile(name, 'vision'), parameters)
    return { tokenizer, text, vision, name }
  } catch (cause) {
    await text.release()
    throw cause
  }
}

async function embedding(session: InferenceSession, input: Tensor, output: string) {
  try {
    const outputs = await session.run({ [session.inputNames[0]]: input }, [output])
    try {
      const data = outputs[output]?.data
      if (!(data instanceof Float32Array) || !data.length) throw Error('Vetor incompatível.')
      const norm = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0))
      if (!Number.isFinite(norm) || norm === 0) throw Error('Vetor inválido.')
      return data.map(value => value / norm)
    } finally { Object.values(outputs).forEach(tensor => tensor.dispose()) }
  } finally { input.dispose() }
}

function textInput(text: string, tokenizer: Tokenizer, clip: boolean) {
  const size = clip ? 77 : 64
  const ids = tokenizer.encode(text).ids
  const input = new BigInt64Array(size).fill(clip ? 49407n : 0n)
  input.set(ids.slice(0, size - 1).map(BigInt))
  if (ids.length >= size) input[size - 1] = BigInt(ids[ids.length - 1])
  return new Tensor('int64', input, [1, size])
}

async function imageInput(file: Blob, clip: boolean) {
  const bitmap = await createImageBitmap(file)
  try {
    const size = clip ? 224 : 256
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw Error('Canvas indisponível.')
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    const crop = Math.min(bitmap.width, bitmap.height)
    if (clip) context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, size, size)
    else context.drawImage(bitmap, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    const plane = size * size
    const input = new Float32Array(3 * plane)
    const mean = clip ? [.48145466, .4578275, .40821073] : [.5, .5, .5]
    const deviation = clip ? [.26862954, .26130258, .27577711] : [.5, .5, .5]
    for (let channel = 0; channel < 3; channel++) {
      for (let pixel = 0; pixel < plane; pixel++) input[channel * plane + pixel] = (data[pixel * 4 + channel] / 255 - mean[channel]) / deviation[channel]
    }
    return new Tensor('float32', input, [1, 3, size, size])
  } finally { bitmap.close() }
}

const images = new Map<string, Float32Array>()
const texts = new Map<string, Float32Array>()
async function memorize(cache: Map<string, Float32Array>, key: string, compute: () => Promise<Float32Array>) {
  const value = cache.get(key) ?? await compute()
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > 60) cache.delete(cache.keys().next().value!)
  return value
}

let runtime: Promise<Awaited<ReturnType<typeof load>>> | undefined
let busy = false
self.onmessage = async ({ data }: MessageEvent<SemanticRequest>) => {
  if (busy) return
  busy = true
  const start = performance.now()
  try {
    runtime ??= load(data.model)
    const { name, tokenizer, text, vision } = await runtime
    if (name !== data.model) throw Error('Modelo incompatível.')
    const ready = performance.now()
    const clip = name === 'clip'
    const outputs = []
    const textVectors = []
    for (const prompt of data.prompts) {
      textVectors.push(await memorize(texts, prompt, () => embedding(text, textInput(prompt, tokenizer, clip), clip ? 'text_embeds' : 'pooler_output')))
    }
    for (const { file, key } of data.images) {
      const vector = await memorize(images, key, async () => embedding(vision, await imageInput(file, clip), clip ? 'image_embeds' : 'pooler_output'))
      outputs.push(textVectors.map(text => text.reduce((sum, value, index) => sum + value * vector[index], 0)))
    }
    self.postMessage({ scores: outputs, loadMs: ready - start, runMs: performance.now() - ready })
  } catch {
    self.postMessage({ error: 'Comparação semântica local indisponível.' })
  } finally { busy = false }
}

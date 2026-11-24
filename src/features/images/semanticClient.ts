export type SemanticRequest = {
  model: 'clip' | 'siglip2'
  prompts: string[]
  images: { key: string; file: Blob }[]
}
type SemanticResult = { scores: number[][]; loadMs: number; runMs: number }

export function createSemanticSession(model: SemanticRequest['model']) {
  const worker = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' })
  let pending = false
  return {
    close: () => worker.terminate(),
    compare(images: SemanticRequest['images'], prompts: string[], signal: AbortSignal): Promise<SemanticResult> {
      if (pending || signal.aborted) return Promise.reject(signal.reason ?? Error('Comparação indisponível.'))
      pending = true
      return new Promise<SemanticResult>((resolve, reject) => {
        function clear() {
          pending = false
          worker.onmessage = null
          worker.onerror = null
          signal.removeEventListener('abort', abort)
        }
        function abort() {
          clear()
          worker.terminate()
          reject(signal.reason)
        }
        signal.addEventListener('abort', abort, { once: true })
        worker.onerror = () => { clear(); reject(Error('Worker semântico indisponível.')) }
        worker.onmessage = ({ data }: MessageEvent<SemanticResult | { error: string }>) => {
          clear()
          if ('error' in data) reject(Error(data.error))
          else resolve(data)
        }
        worker.postMessage({ model, images, prompts } satisfies SemanticRequest)
      })
    },
  }
}

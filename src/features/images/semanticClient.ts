export type SemanticRequest = {
  model: 'clip' | 'siglip2'
  prompts: string[]
  images: { key: string; file: Blob }[]
}
type SemanticResult = { scores: number[][]; loadMs: number; runMs: number }

export function createSemanticSession(model: SemanticRequest['model']) {
  const worker = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' })
  let pending = false
  let closed = false
  let cancel: (() => void) | undefined
  return {
    close() { closed = true; worker.terminate(); cancel?.() },
    compare(images: SemanticRequest['images'], prompts: string[], signal: AbortSignal): Promise<SemanticResult> {
      if (pending || closed || signal.aborted) return Promise.reject(signal.reason ?? Error('Comparação indisponível.'))
      pending = true
      return new Promise<SemanticResult>((resolve, reject) => {
        function clear() {
          pending = false
          cancel = undefined
          worker.onmessage = null
          worker.onerror = null
          signal.removeEventListener('abort', abort)
        }
        function abort() {
          closed = true
          clear()
          worker.terminate()
          reject(signal.reason ?? new DOMException('Sessão encerrada.', 'AbortError'))
        }
        cancel = abort
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

// Keep one warm worker while successive pending frames are being researched.
let clipSession: ReturnType<typeof createSemanticSession> | undefined
let clipBusy = false
let clipIdle: ReturnType<typeof setTimeout> | undefined
export async function compareClip(images: SemanticRequest['images'], prompts: string[], signal: AbortSignal) {
  signal.throwIfAborted()
  if (clipBusy) throw Error('Comparação visual em andamento.')
  clearTimeout(clipIdle)
  clipBusy = true
  try {
    clipSession ??= createSemanticSession('clip')
    return await clipSession.compare(images, prompts, signal)
  } catch (cause) {
    clipSession?.close()
    clipSession = undefined
    throw cause
  } finally {
    clipBusy = false
    if (clipSession) clipIdle = setTimeout(() => {
      clipSession?.close()
      clipSession = undefined
    }, 20_000)
  }
}

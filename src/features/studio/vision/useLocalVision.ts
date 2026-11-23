import { useCallback, useEffect, useRef, useState } from 'react'
import type { VisualAnalysis } from './signals'
import type { VisionMessage, VisionPhoto } from './types'

const empty = new Map<string, VisualAnalysis>()
type Progress = { done: number; total: number }

export function useLocalVision(active: boolean) {
  const worker = useRef<Worker | null>(null)
  const operation = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [analyses, setAnalyses] = useState(empty)
  const [progress, setProgress] = useState<Progress>()
  const [status, setStatus] = useState('')
  const stopWorker = useCallback(() => {
    window.clearTimeout(timer.current)
    worker.current?.terminate()
    worker.current = null
    operation.current = false
  }, [])
  useEffect(() => stopWorker, [stopWorker])
  useEffect(() => {
    if (!active && operation.current) {
      stopWorker()
      queueMicrotask(() => { setProgress(undefined); setStatus('Análise visual interrompida.') })
    }
  }, [active, stopWorker])

  function clear() {
    stopWorker()
    setProgress(undefined); setAnalyses(empty); setStatus('')
  }
  function start(photos: VisionPhoto[]) {
    if (operation.current || !photos.length) return
    operation.current = true
    setProgress({ done: 0, total: photos.length })
    setStatus('')
    let done = 0
    let failed = 0
    const results = new Map<string, VisualAnalysis>()
    const fail = (failure: string) => {
      stopWorker()
      setProgress(undefined)
      setAnalyses(empty)
      setStatus(`${failure} Sugestões por metadados disponíveis.`)
    }
    const resetTimeout = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => fail('A análise local excedeu o tempo de espera.'), 45000)
    }
    try {
      worker.current ??= new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
      worker.current.onerror = () => fail('O navegador não conseguiu executar a análise visual local.')
      worker.current.onmessage = ({ data }: MessageEvent<VisionMessage>) => {
        if (data.type === 'error') { fail(data.message); return }
        if (data.type === 'complete') {
          window.clearTimeout(timer.current)
          operation.current = false
          setProgress(undefined)
          setAnalyses(results)
          const identified = [...results.values()].filter(item => item.cue).length
          setStatus(`${identified} de ${photos.length} imagens com classes visuais reconhecidas.${failed ? ` ${failed} não puderam ser analisadas.` : ''}`)
          return
        }
        if (data.type === 'result') results.set(data.id, data.analysis)
        else failed++
        setProgress({ done: ++done, total: photos.length })
        resetTimeout()
      }
      resetTimeout()
      worker.current.postMessage(photos.map(({ id, file }) => ({ id, file })))
    } catch {
      fail('Não foi possível iniciar a análise visual local.')
    }
  }
  return { analyses, progress, status, start, clear }
}

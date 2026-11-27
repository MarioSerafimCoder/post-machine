import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { type AutomaticImage, type VisualRequest, type VisualStatus } from './automaticSearch'
import { investigateVisuals } from './searchOrchestrator'
import { attemptText } from './searchDiagnostics'

type Result = { signature: string; image?: AutomaticImage; status: VisualStatus; provisional?: boolean; attempts?: string[]; authorization?: { page: string; url: string }[] }
const requestId = (request: VisualRequest) => request.key + ':' + request.signature
export function useAutomaticImages(active: boolean, requests: VisualRequest[], occupied: ReadonlySet<string>,
  apply: (request: VisualRequest, image: AutomaticImage) => boolean | 'application', onEmpty?: (request: VisualRequest, status: VisualStatus) => boolean | void,
  applyBlocked?: string | boolean) {
  const [results, setResults] = useState<Record<string, Result>>({})
  const consumed = useRef(new Set<string>())
  const seen = useRef(new Set<string>())
  const applied = useRef(new Map<string, { id: string; classification?: string }>())
  const operation = useRef<AbortController | undefined>(undefined)
  const [applicationRevision, setApplicationRevision] = useState(0)
  const requested = requests.map(requestId).join('|')
  const read = useEffectEvent(() => ({ requests, occupied, results }))
  const accept = useEffectEvent(apply)
  const noMatch = useEffectEvent((request: VisualRequest, status: VisualStatus) => onEmpty?.(request, status))

  useEffect(() => {
    if (!active || !requested) return
    const controller = new AbortController()
    operation.current = controller
    const signal = controller.signal
    const timer = setTimeout(() => {
      const latest = read()
      const pending = latest.requests.filter(request => latest.results[request.key]?.signature !== request.signature)
      const attempts = new Map(pending.map(request => [request.key, [] as string[]]))
      const record = (request: VisualRequest, result: Omit<Result, 'signature'>) => {
        if (signal.aborted) return
        setResults(previous => Object.fromEntries([...Object.entries(previous).filter(([key]) => latest.requests.some(item => item.key === key)),
          [request.key, { ...result, signature: request.signature }]]))
      }
      void investigateVisuals(pending, {
        used: () => read().occupied,
        trace: event => {
          const line = attemptText(event)
          if (!line) return
          for (const [key, log] of attempts) if ((!event.slide || key === event.slide) && !log.includes(line) && log.length < 48) log.push(line)
        },
        image: (request, image, provisional) => record(request, { image,
          status: provisional ? 'provisional' : image.match.strategy === 'editorial' ? 'editorial' : 'documental', provisional }),
        finish: (request, status, authorization) => {
          if (signal.aborted) return
          setResults(previous => {
            const result = previous[request.key]
            return { ...previous, [request.key]: result?.signature === request.signature && result.image
              ? { ...result, status: result.image.match.strategy === 'editorial' ? 'editorial' : 'documental', provisional: false }
              : { signature: request.signature, status, authorization, attempts: attempts.get(request.key) } }
          })
        },
      }, signal).catch(() => pending.forEach(request => record(request, { status: 'error' })))
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [active, requested])

  useEffect(() => {
    if (!active || applyBlocked === true) return
    const timer = setTimeout(() => {
      const visible = new Set(requests.map(requestId))
      for (const key of seen.current) if (!visible.has(key)) {
        seen.current.delete(key); consumed.current.delete(key); applied.current.delete(key)
      }
      for (const request of requests) {
        const key = requestId(request)
        const result = results[request.key]
        if (request.key === applyBlocked || consumed.current.has(key) || result?.signature !== request.signature) continue
        seen.current.add(key)
        if (!result.image) {
          if (noMatch(request, result.status) !== false) consumed.current.add(key)
        } else {
          const prior = applied.current.get(key)
          if (prior?.id === result.image.id && prior.classification === result.image.match.classification) {
            if (!result.provisional) consumed.current.add(key)
            continue
          }
          if (result.status === 'application') continue
          let accepted: boolean | 'application'
          try { accepted = accept(request, result.image) } catch { accepted = 'application' }
          if (accepted === 'application') {
            setResults(previous => ({ ...previous, [request.key]: { ...result, status: 'application' } }))
          } else if (accepted) {
            applied.current.set(key, { id: result.image.id, classification: result.image.match.classification })
            if (!result.provisional) consumed.current.add(key)
            return
          }
        }
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [active, requests, results, applyBlocked, applicationRevision])

  return {
    cancel() {
      operation.current?.abort()
      setResults(previous => ({ ...previous, ...Object.fromEntries(requests.filter(request => !previous[request.key]?.image).map(request =>
        [request.key, { signature: request.signature, status: 'cancelled' as const }])) }))
    },
    retryApplication(request: VisualRequest) {
      setResults(previous => {
        const result = previous[request.key]
        return result?.signature === request.signature && result.image ? { ...previous, [request.key]: { ...result, status: 'documental' } } : previous
      })
      setApplicationRevision(value => value + 1)
    },
    attempts(request: VisualRequest | undefined) {
      const result = request && results[request.key]
      return result?.signature === request?.signature ? result?.attempts : undefined
    },
    authorization(request: VisualRequest | undefined) {
      const result = request && results[request.key]
      return result?.signature === request?.signature ? result?.authorization : undefined
    },
    status(request: VisualRequest | undefined): VisualStatus | undefined {
      if (!request) return
      const result = results[request.key]
      return result?.signature === request.signature ? result.provisional ? 'provisional' : result.status : 'documental'
    },
  }
}

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { findAutomaticImage, type AutomaticImage, type VisualQuery, type VisualStatus } from './automaticSearch'

export type VisualRequest = { key: string; query: VisualQuery; signature: string }
type Job = { request: VisualRequest; controller: AbortController; running: boolean }
type Status = { signature: string; status: VisualStatus }

export function useAutomaticImages(active: boolean, requests: VisualRequest[], occupied: ReadonlySet<string>,
  apply: (request: VisualRequest, image: AutomaticImage) => boolean, onEmpty?: (request: VisualRequest) => void) {
  const jobs = useRef(new Map<string, Job>())
  const finished = useRef(new Map<string, string>())
  const used = useRef(new Set<string>())
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const getInputs = useEffectEvent(() => ({ active, requests, occupied }))
  const accept = useEffectEvent(apply)
  const noMatch = useEffectEvent((request: VisualRequest) => onEmpty?.(request))

  useEffect(() => {
    const queue = jobs.current
    const completed = finished.current
    const reserved = used.current
    return () => { queue.forEach(job => job.controller.abort()); queue.clear(); completed.clear(); reserved.clear() }
  }, [])

  useEffect(() => {
    const incoming = new Map(active ? requests.map(item => [item.key, item]) : [])
    used.current.clear()
    occupied.forEach(key => used.current.add(key))
    for (const [key, job] of jobs.current) {
      if (incoming.get(key)?.signature !== job.request.signature) {
        job.controller.abort()
        jobs.current.delete(key)
      }
    }
    for (const [key, signature] of finished.current) {
      if (incoming.get(key)?.signature !== signature) finished.current.delete(key)
    }
    for (const [key, request] of incoming) {
      if (!jobs.current.has(key) && finished.current.get(key) !== request.signature) {
        jobs.current.set(key, { request, controller: new AbortController(), running: false })
      }
    }
    const timer = window.setTimeout(() => {
      const reserved = used.current
      function startNext() {
        const latest = getInputs()
        if (!latest.active) return
        latest.occupied.forEach(key => reserved.add(key))
        const running = [...jobs.current.values()].filter(job => job.running).length
        for (const job of [...jobs.current.values()].filter(job => !job.running).slice(0, Math.max(0, 2 - running))) {
          job.running = true
          const { request, controller } = job
          const report = (status: VisualStatus) => {
            if (!controller.signal.aborted) setStatuses(current => ({ ...current, [request.key]: { signature: request.signature, status } }))
          }
          report('documental')
          void findAutomaticImage(request.query, controller.signal, reserved, report).then(image => {
            if (controller.signal.aborted || !getInputs().requests.some(item => item.key === request.key && item.signature === request.signature)) return
            if (image && accept(request, image)) {
              image.keys.forEach(key => reserved.add(key))
              if (image.creator) reserved.add('autor:' + image.creator.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())
            } else { report('empty'); if (!image) noMatch(request) }
          }, () => report('error')).finally(() => {
            if (jobs.current.get(request.key) !== job) return
            jobs.current.delete(request.key)
            if (!controller.signal.aborted) finished.current.set(request.key, request.signature)
            startNext()
          })
        }
      }
      startNext()
    }, 320)
    return () => window.clearTimeout(timer)
  }, [active, requests, occupied])

  return {
    status: (request: VisualRequest | undefined): VisualStatus | undefined => request
      ? (statuses[request.key]?.signature === request.signature ? statuses[request.key].status : 'documental')
      : undefined,
  }
}

export function requestFor(key: string, query: VisualQuery, revision = 0): VisualRequest {
  return { key, query, signature: JSON.stringify([query.stages.map(stage => stage.query), query.terms, query.ratio, revision]) }
}

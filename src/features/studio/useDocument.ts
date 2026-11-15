import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { SaveQueue } from '../../lib/saveQueue'
import type { Project } from './model'
import { saveProject } from './storage'
export function useDocument(initial?: Project) {
  const [project, display] = useState<Project | undefined>(initial)
  const current = useRef(initial)
  const past = useRef<Project[]>([]), future = useRef<Project[]>([])
  const [status, setStatus] = useState('Salvo')
  const [history, setHistory] = useState({ undo: false, redo: false })
  const [queue] = useState(() => new SaveQueue<Project>(saveProject, (_, state) => setStatus(state === 'saved' ? 'Salvo' : state === 'saving' ? 'Salvando…' : 'Falha ao salvar'), 500))
  const apply = useCallback((action: SetStateAction<Project | undefined>, record = true) => {
    const next = typeof action === 'function' ? action(current.current) : action
    if (record && current.current && next?.id === current.current.id) { past.current = [...past.current.slice(-29), current.current]; future.current = [] }
    if (next?.id !== current.current?.id) { past.current = []; future.current = [] }
    current.current = next; display(next)
    setHistory({ undo: past.current.length > 0, redo: future.current.length > 0 })
    if (next) queue.schedule(next.id, next)
  }, [queue])
  const undo = () => { const next = past.current.pop(); if (!next || !current.current) return; future.current.push(current.current); apply(next, false) }
  const redo = () => { const next = future.current.pop(); if (!next || !current.current) return; past.current.push(current.current); apply(next, false) }
  useEffect(() => {
    if (initial) queue.schedule(initial.id, initial)
    const flush = () => { void queue.flushAll().catch(() => undefined) }
    const leave = (event: BeforeUnloadEvent) => { if (queue.hasPending) { flush(); event.preventDefault() } }
    window.addEventListener('hashchange', flush); document.addEventListener('visibilitychange', flush); window.addEventListener('beforeunload', leave)
    return () => { flush(); window.removeEventListener('hashchange', flush); document.removeEventListener('visibilitychange', flush); window.removeEventListener('beforeunload', leave) }
  }, [initial, queue])
  return { project, setProject: apply, undo, redo, history, status, flush: () => queue.flushAll() }
}

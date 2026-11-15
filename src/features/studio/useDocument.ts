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
  const [persisted] = useState(() => new Map<string, Project>())
  const [queue] = useState(() => {
    let releaseDraft: (() => void) | undefined
    const saves: SaveQueue<Project> = new SaveQueue(async value => {
      await saveProject(value, persisted.get(value.id))
      persisted.set(value.id, value)
    }, (_, state) => {
      setStatus(state === 'saved' ? 'Salvo' : state === 'saving' ? 'Salvando…' : 'Falha ao salvar')
      if (state === 'saving' && !releaseDraft && navigator.locks) {
        const pending = new Promise<void>(resolve => { releaseDraft = resolve })
        void navigator.locks.request('post-machine-studio-drafts', { mode: 'shared' }, () => pending)
      } else if (state === 'saved' && !saves.hasPending) {
        releaseDraft?.()
        releaseDraft = undefined
      }
    }, 500)
    return saves
  })
  const apply = useCallback((action: SetStateAction<Project | undefined>, record = true, fromStorage = false) => {
    const next = typeof action === 'function' ? action(current.current) : action
    if (record && current.current && next?.id === current.current.id) { past.current = [...past.current.slice(-29), current.current]; future.current = [] }
    if (next?.id !== current.current?.id) { past.current = []; future.current = [] }
    current.current = next; display(next)
    setHistory({ undo: past.current.length > 0, redo: future.current.length > 0 })
    if (next && fromStorage) { persisted.set(next.id, next); setStatus('Salvo') }
    else if (next) queue.schedule(next.id, next)
  }, [persisted, queue])
  const undo = () => { const next = past.current.pop(); if (!next || !current.current) return; future.current.push(current.current); apply(next, false) }
  const redo = () => { const next = future.current.pop(); if (!next || !current.current) return; past.current.push(current.current); apply(next, false) }
  useEffect(() => {
    if (initial) queue.schedule(initial.id, initial)
    const flush = () => { void queue.flushAll().catch(() => undefined) }
    const leave = (event: BeforeUnloadEvent) => { if (queue.hasPending) { flush(); event.preventDefault() } }
    window.addEventListener('hashchange', flush); document.addEventListener('visibilitychange', flush); window.addEventListener('beforeunload', leave)
    return () => { flush(); window.removeEventListener('hashchange', flush); document.removeEventListener('visibilitychange', flush); window.removeEventListener('beforeunload', leave) }
  }, [initial, queue])
  const flush = useCallback(() => queue.flushAll(), [queue])
  return { project, setProject: apply, getCurrent: () => current.current, undo, redo, history, status, flush }
}

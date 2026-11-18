import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import type { Draft } from '../campaigns/contract'
import { preferences, type Preference } from './types'

const schema = z.object({
  mode: z.enum(['proactive', 'manual', 'muted']),
  history: z.array(z.object({
    scope: z.string().max(100), id: z.string().max(180), ruleId: z.string().max(30).optional(),
    preference: z.enum(preferences).optional(),
    outcome: z.enum(['accepted', 'dismissed']), at: z.iso.datetime(),
  })).max(80),
})
type Memory = z.infer<typeof schema>
const key = 'post-machine:editorial-assistant:v1'
const empty: Memory = { mode: 'proactive', history: [] }
const read = (): Memory | undefined => {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? undefined : schema.parse(JSON.parse(stored))
  } catch { return undefined }
}
let memory = read() ?? empty
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (callback: () => void) => {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}
export const useEditorialMemory = () => useSyncExternalStore(subscribe, () => memory, () => empty)

// Storage events originate in other tabs; same-tab changes are published by save().
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return
    const latest = read() ?? empty
    if (JSON.stringify(latest) === JSON.stringify(memory)) return
    memory = latest
    emit()
  })
}

function save(next: Memory) {
  memory = next
  try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* In-memory mode remains available. */ }
  emit()
}
const currentMemory = () => read() ?? memory
export const setAssistantMode = (mode: Memory['mode']) => save({ ...currentMemory(), mode })
export const resetEditorialMemory = () => save({ ...currentMemory(), history: [] })
export function recordEditorialFeedback(entry: Omit<Memory['history'][number], 'at'>) {
  const latest = currentMemory()
  const retained = latest.history.filter(item => item.scope !== entry.scope || item.id !== entry.id)
  save({ ...latest, history: [...retained, { ...entry, at: new Date().toISOString() }].slice(-80) })
}
export function preferenceFor(history: Memory['history'], scope: string, preference: Preference) {
  return history.reduce((score, item) => item.scope === scope && item.preference === preference
    ? score + (item.outcome === 'accepted' ? 1 : -1) : score, 0)
}
export const campaignScope = (draft: Draft) => draft.briefing.editorialProfile?.trim()
  ? `perfil:${draft.briefing.editorialProfile.trim()}` : `campanha:${draft.id}`

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
const read = (): Memory => {
  try { return schema.parse(JSON.parse(localStorage.getItem(key) ?? 'null')) }
  catch { return empty }
}
let memory = read()
const listeners = new Set<() => void>()
const subscribe = (callback: () => void) => {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}
export const useEditorialMemory = () => useSyncExternalStore(subscribe, () => memory, () => empty)

function save(next: Memory) {
  memory = next
  try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Memory remains available in this session. */ }
  listeners.forEach(listener => listener())
}
export const setAssistantMode = (mode: Memory['mode']) => save({ ...memory, mode })
export const resetEditorialMemory = () => save({ ...memory, history: [] })
export function recordEditorialFeedback(entry: Omit<Memory['history'][number], 'at'>) {
  const latest = read()
  const history = latest === empty ? memory.history : latest.history
  const retained = history.filter(item => item.scope !== entry.scope || item.id !== entry.id)
  save({ ...memory, history: [...retained, { ...entry, at: new Date().toISOString() }].slice(-80) })
}
export function preferenceFor(history: Memory['history'], scope: string, preference: Preference) {
  return history.reduce((score, item) => item.scope === scope && item.preference === preference
    ? score + (item.outcome === 'accepted' ? 1 : -1) : score, 0)
}
export const campaignScope = (draft: Draft) => draft.briefing.editorialProfile?.trim()
  ? `perfil:${draft.briefing.editorialProfile.trim()}` : `campanha:${draft.id}`

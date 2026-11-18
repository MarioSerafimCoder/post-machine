import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { Page } from '../../lib/navigation'
import type { Insight, Preference } from './types'

export type Signal = {
  area: Page; priority: number; scope: string; insight: Insight; preference?: Preference
  category?: 'audit' | 'editing' | 'production' | 'research'
  subject?: string; version?: string; severity?: 'blocking' | 'warning'
}
type QueuedSignal = Signal & { createdAt: number }
export const signalVersion = (item: Signal) => JSON.stringify([item.area, item.scope, item.insight.id, item.version ?? [item.insight.title, item.insight.detail]])
export const signalIdentity = (item: Signal) => JSON.stringify([item.scope, item.insight.id])

export function visibleSignals(signals: readonly Signal[], area: Page | 'not-found',
  history: readonly { scope: string; id: string; version?: string }[]) {
  const excluded = new Map(history.map(item => [JSON.stringify([item.scope, item.id]), item.version ?? null]))
  const unique = new Map<string, Signal>()
  const rank = (item: Signal) => (item.severity === 'blocking' ? 1000 : item.category === 'audit' ? 100 : 0) + item.priority
  for (const item of signals) {
    if (item.area !== area) continue
    const key = signalIdentity(item)
    const previous = unique.get(key)
    const decision = excluded.get(key)
    if (decision !== null && decision !== signalVersion(item) && (!previous || rank(item) > rank(previous))) unique.set(key, item)
  }
  return [...unique.values()].sort((a, b) => rank(b) - rank(a))
}

export function createAssistantSignals() {
  const entries = new Map<symbol, QueuedSignal>()
  const listeners = new Set<() => void>()
  let snapshot: readonly Signal[] = []
  let anchor: HTMLElement | null = null
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshot: () => snapshot,
    anchor: () => anchor,
    setAnchor(next: HTMLElement | null) {
      if (anchor === next) return
      anchor = next
      listeners.forEach(listener => listener())
    },
    update(key: symbol, signal?: Signal) {
      const previous = entries.get(key)
      if (!signal && !previous) return
      if (signal) entries.set(key, { ...signal, createdAt: previous && signalVersion(previous) === signalVersion(signal) ? previous.createdAt : Date.now() })
      else entries.delete(key)
      snapshot = [...entries.values()].sort((a, b) => a.createdAt - b.createdAt)
      listeners.forEach(listener => listener())
    },
  }
}

export const AssistantSignals = createContext<ReturnType<typeof createAssistantSignals> | null>(null)

export function useAssistantSignal(signal?: Signal) {
  const bus = useContext(AssistantSignals)
  const [id] = useState(() => Symbol())
  useLayoutEffect(() => {
    bus?.update(id, signal)
  }, [bus, id, signal])
  useLayoutEffect(() => () => bus?.update(id), [bus, id])
}

const empty: readonly Signal[] = []
export function useAssistantSignals() {
  const bus = useContext(AssistantSignals)
  return useSyncExternalStore(bus?.subscribe ?? (() => () => undefined), bus?.snapshot ?? (() => empty), () => empty)
}

export function useAssistantAnchor(active: boolean) {
  const bus = useContext(AssistantSignals)
  return useCallback((node: HTMLDivElement | null) => { if (active) bus?.setAnchor(node) }, [active, bus])
}

export function useStudioAnchor() {
  const bus = useContext(AssistantSignals)
  return useSyncExternalStore(bus?.subscribe ?? (() => () => undefined), bus?.anchor ?? (() => null), () => null)
}

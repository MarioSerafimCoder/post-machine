import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from 'react'
import type { Page } from '../../lib/navigation'
import type { Insight, Preference } from './types'

export type Signal = { area: Page; priority: number; scope: string; insight: Insight; preference?: Preference }

export function createAssistantSignals() {
  const entries = new Map<symbol, Signal>()
  const listeners = new Set<() => void>()
  let snapshot: readonly Signal[] = []
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshot: () => snapshot,
    update(key: symbol, signal?: Signal) {
      if (signal ? entries.get(key) === signal : !entries.has(key)) return
      if (signal) entries.set(key, signal)
      else entries.delete(key)
      snapshot = [...entries.values()].sort((a, b) => b.priority - a.priority)
      listeners.forEach(listener => listener())
    },
  }
}

export const AssistantSignals = createContext<ReturnType<typeof createAssistantSignals> | null>(null)

export function useAssistantSignal(signal?: Signal) {
  const bus = useContext(AssistantSignals)
  useLayoutEffect(() => {
    if (!bus || !signal) return
    const id = Symbol()
    bus.update(id, signal)
    return () => bus.update(id)
  }, [bus, signal])
}

const empty: readonly Signal[] = []
export function useAssistantSignals(area: Page | 'not-found') {
  const bus = useContext(AssistantSignals)
  const signals = useSyncExternalStore(bus?.subscribe ?? (() => () => undefined), bus?.snapshot ?? (() => empty), () => empty)
  return signals.filter(item => item.area === area)
}

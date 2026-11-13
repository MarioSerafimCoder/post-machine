import { useSyncExternalStore } from 'react'

export const pages = ['inicio', 'radar', 'studio', 'auditoria'] as const
export type Page = typeof pages[number]
export function resolvePage(hash: string): Page | 'not-found' {
  const value = hash.replace(/^#\/?/, '') || 'inicio'
  return pages.includes(value as Page) ? value as Page : 'not-found'
}
function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
export function usePage() {
  return useSyncExternalStore(subscribe, () => resolvePage(window.location.hash), () => 'inicio' as const)
}

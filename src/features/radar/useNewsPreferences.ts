import { useState } from 'react'
import type { Article } from './contract'
import { preferenceChange, type EditorialPreferences } from './relevance'
const key = 'post-machine:radar-editorial-preferences:v1'
function load(): EditorialPreferences {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter(([key, value]) => key.startsWith('category:') &&
      typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 5))
  } catch { return {} }
}
export function useNewsPreferences() {
  const [preferences, setPreferences] = useState(load)
  const [error, setError] = useState(false)
  function save(value: EditorialPreferences) {
    try { localStorage.setItem(key, JSON.stringify(value)); setPreferences(value); setError(false) }
    catch { setError(true) }
  }
  return { preferences, error, reset: () => save({}), learn: (article: Article, delta: number) => save(preferenceChange(preferences, article, delta)) }
}

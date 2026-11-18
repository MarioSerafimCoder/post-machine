import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const key = 'post-machine:editorial-assistant:v1'

it('sincroniza a memória entre abas sem perder modo e decisões ao registrar feedback', async () => {
  localStorage.removeItem(key)
  vi.resetModules()
  const { useEditorialMemory, recordEditorialFeedback, setAssistantMode } = await import('./feedback')
  const { result, unmount } = renderHook(() => useEditorialMemory())
  expect(result.current.mode).toBe('proactive')
  const external = {
    mode: 'manual',
    history: [{ scope: 'perfil:Equipe A', id: 'title:1', outcome: 'accepted', at: '2026-11-18T12:00:00.000Z' }],
  }
  act(() => {
    localStorage.setItem(key, JSON.stringify(external))
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(external), storageArea: localStorage }))
  })
  expect(result.current).toEqual(external)
  act(() => recordEditorialFeedback({ scope: 'perfil:Equipe A', id: 'title:2', outcome: 'dismissed' }))
  expect(result.current.history.map(item => item.id)).toEqual(['title:1', 'title:2'])
  expect(result.current.mode).toBe('manual')
  act(() => setAssistantMode('muted'))
  expect(JSON.parse(localStorage.getItem(key)!).mode).toBe('muted')
  act(() => {
    localStorage.removeItem(key)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: null, storageArea: localStorage }))
  })
  expect(result.current).toEqual({ mode: 'proactive', history: [] })
  unmount()
})

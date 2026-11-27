import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAutomaticImages } from './useAutomaticImages'
import { investigateVisuals } from './searchOrchestrator'
import { requestFor, type AutomaticImage, type VisualRequest } from './automaticSearch'
import { campaignContext } from './visualContext'

vi.mock('./searchOrchestrator', () => ({ investigateVisuals: vi.fn(async () => undefined) }))
const copy = { title: 'Objeto específico', imageBrief: 'Foto documental do objeto', role: 'cover' }
const request = requestFor('campaign-a/slide-a', copy, campaignContext({ title: copy.title, slides: [copy] }), 1)!
const image = { id: 'received-file', match: { strategy: 'documental', classification: 'confirmed', reason: 'Fonte' } } as AutomaticImage
type Events = Parameters<typeof investigateVisuals>[1]
let events: Events
let signal: AbortSignal
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(investigateVisuals).mockImplementation(async (_requests, callbacks, operation) => { events = callbacks; signal = operation })
})
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(220) })

test.each(['manual', 'campaign'])('resposta atrasada não substitui escolha %s ou campanha atual', async mode => {
  const apply = vi.fn(() => true)
  const hook = renderHook(({ requests }: { requests: VisualRequest[] }) => useAutomaticImages(true, requests, new Set(), apply),
    { initialProps: { requests: [request] } })
  await tick()
  const oldEvents = events
  const oldSignal = signal
  hook.rerender({ requests: mode === 'manual' ? [] : [{ ...request, key: 'campaign-b/slide-b', slideId: 'slide-b' }] })
  expect(oldSignal.aborted).toBe(true)
  act(() => oldEvents.image(request, image, false))
  await tick()
  expect(apply).not.toHaveBeenCalled()
})

test('falha de aplicação reaproveita o arquivo recebido e cancelamento aborta a investigação', async () => {
  const apply = vi.fn<() => boolean | 'application'>(() => 'application')
  const empty = vi.fn(() => true)
  const hook = renderHook(() => useAutomaticImages(true, [request], new Set(), apply, empty))
  await tick()
  act(() => events.image(request, image, false))
  await tick()
  expect(hook.result.current.status(request)).toBe('application')
  apply.mockReturnValue(true)
  act(() => hook.result.current.retryApplication(request))
  await tick()
  expect(apply).toHaveBeenCalledTimes(2)
  expect(investigateVisuals).toHaveBeenCalledTimes(1)
  act(() => hook.result.current.cancel())
  expect(signal.aborted).toBe(true)
})

test('indisponibilidade e cancelamento chegam à recuperação, mesmo após espera por seleção ativa', async () => {
  const empty = vi.fn(() => true)
  const hook = renderHook(({ blocked }) => useAutomaticImages(true, [request], new Set(), () => true, empty, blocked),
    { initialProps: { blocked: true } })
  await tick()
  act(() => events.finish(request, 'incompatible'))
  await tick()
  expect(empty).not.toHaveBeenCalled()
  hook.rerender({ blocked: false })
  await tick()
  expect(empty).toHaveBeenCalledWith(request, 'incompatible')
})

test('cancelar antes da chegada do arquivo aciona recuperação e ignora resposta tardia', async () => {
  const apply = vi.fn(() => true), empty = vi.fn(() => true)
  const hook = renderHook(() => useAutomaticImages(true, [request], new Set(), apply, empty))
  await tick()
  act(() => hook.result.current.cancel())
  expect(signal.aborted).toBe(true)
  act(() => events.image(request, image, false))
  await tick()
  expect(apply).not.toHaveBeenCalled()
  expect(empty).toHaveBeenCalledWith(request, 'cancelled')
})

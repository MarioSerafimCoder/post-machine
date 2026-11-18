import { expect, it } from 'vitest'
import { createAssistantSignals, signalVersion, visibleSignals, type Signal } from './signals'

const editing: Signal = {
  area: 'studio', scope: 'project', priority: 50, category: 'editing',
  insight: { id: 'title', title: 'Revise o título', detail: 'Recorte atual', assessment: 'heuristic' },
}

it('prioriza auditoria vigente, elimina duplicatas e exclui outros contextos e decisões registradas', () => {
  const audit: Signal = { ...editing, priority: 10, category: 'audit', insight: { ...editing.insight, id: 'audit' } }
  const dismissed: Signal = { ...editing, insight: { ...editing.insight, id: 'dismissed' } }
  const inactive: Signal = { ...editing, area: 'radar', insight: { ...editing.insight, id: 'radar' } }
  expect(visibleSignals([editing, audit, editing, dismissed, inactive], 'studio', [{ scope: 'project', id: 'dismissed' }]))
    .toEqual([audit, editing])
})

it('remove o sinal resolvido ou obsoleto e distingue versões sem mudar o ID de feedback', () => {
  const bus = createAssistantSignals()
  const key = Symbol()
  bus.update(key, editing)
  const updated = { ...editing, insight: { ...editing.insight, detail: 'Novo recorte' } }
  bus.update(key, updated)
  expect(bus.snapshot()).toHaveLength(1)
  expect(signalVersion(bus.snapshot()[0])).not.toBe(signalVersion(editing))
  const history = [{ scope: editing.scope, id: editing.insight.id, version: signalVersion(editing) }]
  expect(visibleSignals([editing], 'studio', history)).toEqual([])
  expect(visibleSignals([updated], 'studio', history)).toEqual([updated])
  bus.update(key)
  expect(bus.snapshot()).toEqual([])
})

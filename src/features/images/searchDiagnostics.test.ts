import { expect, test } from 'vitest'
import { failureKind, isSearchFailure, VisualSearchError } from './searchDiagnostics'
test('distingue bloqueio, cota, tempo, conexão e arquivo incompatível', () => {
  for (const kind of ['blocked','limited','download','incompatible','insufficient'] as const) {
    expect(failureKind(new VisualSearchError(kind))).toBe(kind)
    expect(isSearchFailure(kind)).toBe(true)
  }
  expect(failureKind(new DOMException('Prazo', 'TimeoutError'))).toBe('timeout')
  expect(failureKind(new TypeError('Network'))).toBe('connection')
  expect(isSearchFailure('documental')).toBe(false)
})

import { describe, expect, it } from 'vitest'
import { analyzeHeadline, characterCount } from './analysis'
import { importSuggestions, newSession, type HeadlineContext } from './contract'
import { buildHeadlinePrompt, ruleSuggestions } from './suggest'

const context: HeadlineContext = {
  briefing: 'Uso da cor na comunicação editorial', audience: 'Designers', format: 'carrossel', objective: 'Educar', tone: 'Profissional',
  selectedSlide: 1, slides: [{ title: 'Uso da cor', body: 'O contraste ajuda a distinguir informações. A escala tipográfica organiza a leitura.' }],
  sources: [{ title: 'Referência do briefing', url: 'https://example.com/fonte' }],
}

describe('Agente de Headlines', () => {
  it('conta grafemas e palavras e informa repetições mensuradas', () => {
    expect(characterCount('a\u0301 👩‍💻')).toBe(3)
    const result = analyzeHeadline('Cor e cor na página', { maxChars: 10, maxWords: 4 }, context)
    expect(result).toMatchObject({ characters: 19, words: 5 })
    expect(result.measured.join(' ')).toContain('cor (2×)')
    expect(result.measured).toHaveLength(3)
  })
  it('sinaliza clichê e promessa como heurísticas', () => {
    const result = analyzeHeadline('VOCÊ NÃO VAI ACREDITAR!! 99% GARANTIDO', newSession(''), context)
    expect(result.heuristic.join(' ')).toMatch(/Possível clichê/)
    expect(result.heuristic.join(' ')).toMatch(/precisa ser conferido/)
  })
  it('usa trechos fornecidos no modo local e evita inventar quando faltam dados', () => {
    expect(ruleSuggestions('Uso da cor', context, newSession('Uso da cor'))[0].text).toBe('O contraste ajuda a distinguir informações')
    expect(ruleSuggestions('Teste', { ...context, slides: [], briefing: '' }, newSession('Teste'))).toEqual([])
  })
  it('gera prompt com título, briefing, fonte e contrato versionado', () => {
    const prompt = buildHeadlinePrompt('Uso da cor', context, newSession('Uso da cor'))
    for (const expected of ['Uso da cor', 'Designers', 'Profissional', 'Educar', 'https://example.com/fonte', 'schemaVersion', 'external-ai', '90 caracteres']) expect(prompt).toContain(expected)
  })
  it('valida JSON e mantém textos externos como dados', () => {
    const candidate = { id: 'headline-01', text: '<img src=x>', approach: 'direta', rationale: 'Trecho editorial', source: 'external-ai' }
    expect(importSuggestions(JSON.stringify({ schemaVersion: 1, suggestions: [candidate] }))[0]).toEqual(candidate)
    expect(() => importSuggestions(JSON.stringify({ schemaVersion: 1, suggestions: [candidate, candidate] }))).toThrow()
    expect(() => importSuggestions('HTML inválido')).toThrow('JSON válido')
    expect(() => importSuggestions(JSON.stringify({ schemaVersion: 2, suggestions: [candidate] }))).toThrow()
  })
})

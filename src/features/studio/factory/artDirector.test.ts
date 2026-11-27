import { describe, expect, it } from 'vitest'
import { chooseCollection, chooseProposal } from './artDirector'
import { collections } from '../collections'
import type { Proposal } from './fabricate'

describe('direção automática sobre coleções existentes', () => {
  it('considera assunto, comparação, texto longo, imagem e formato sem alterar o conteúdo', () => {
    const original = { title: 'Identidade visual da marca', body: 'A decisão de design foi apresentada.' }
    for (const format of ['portrait', 'square', 'story'] as const) {
      expect(chooseCollection([original], format, false, collections[0]).id).toBe('minimal')
      expect(chooseCollection([{ ...original, intent: 'comparison' }], format, false, collections[0]).id).toBe('swiss')
      expect(chooseCollection([{ title: 'Campanha', body: 'Texto '.repeat(100) }], format, false, collections[0]).id).toBe('magazine')
      expect(chooseCollection([{ title: 'Campanha', body: '', imageBrief: 'Foto documental' }], format, true, collections[0]).id).toBe('photo')
      expect(chooseCollection([original], format, false, collections[0], 1).id).toBe('swiss')
    }
    expect(original).toEqual({ title: 'Identidade visual da marca', body: 'A decisão de design foi apresentada.' })
  })
  it('descarta a proposta com transbordamento e favorece variedade quando não há avisos', () => {
    const proposal = (compositions: number[], messages: string[]): Proposal => ({ treatment: 'balanced', project: { id: 'x' } as Proposal['project'],
      details: compositions.map((composition, index) => ({ composition, issues: messages[index] ?
        [{ kind: 'text' as const, message: messages[index] }] : [] })) })
    const repeated = proposal([0, 0], [])
    const varied = proposal([0, 1], [])
    const overflow = proposal([0, 1], ['Texto excede o espaço disponível.'])
    expect(chooseProposal([overflow, repeated, varied])).toBe(varied)
  })
})

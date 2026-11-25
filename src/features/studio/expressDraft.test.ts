import { expect, test } from 'vitest'
import { reconcileExpressSlides, type ExpressSlide } from './expressDraft'
import { parseExpress } from './expressContent'

test('mantém a foto da peça reconhecida ao reorganizar e libera associações ambíguas', () => {
  const first: ExpressSlide = { key: 'a', title: 'Título A', body: 'Corpo A', imageId: 'foto-a', framing: 'contain', visualDecision: 'replaced' }
  const second: ExpressSlide = { key: 'b', title: 'Título B', body: 'Corpo B', imageId: 'foto-b' }
  const reorder = reconcileExpressSlides([
    { title: second.title, body: second.body }, { title: first.title, body: first.body },
  ], [first, second], () => 'novo')
  expect(reorder.map(({ key, imageId }) => [key, imageId])).toEqual([['b', 'foto-b'], ['a', 'foto-a']])
  expect(reorder[1].framing).toBe('contain')
  expect(reorder[1].visualDecision).toBe('replaced')
  expect(reconcileExpressSlides([first, first], [first], () => 'novo').every(slide => slide.imageId === undefined)).toBe(true)
})

test('respeita o layout textual importado e conserva vínculos manuais das peças reconhecidas', () => {
  const { slides } = parseExpress(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Edição', objective: 'Informar', audience: 'Editores', tone: 'Direto', format: 'post', caption: '', cta: '' },
    sources: [], slides: [{ order: 1, role: 'content', title: 'Tipografia', body: 'Uma escolha editorial.', imageBrief: '', layoutType: 'somente texto' }],
  }))
  const [fresh] = reconcileExpressSlides(slides, [], () => 'nova')
  expect(fresh.imageId).toBeNull()
  expect(reconcileExpressSlides(slides, [{ ...fresh, imageId: 'foto', imageLocked: true }], () => 'outra')[0])
    .toMatchObject({ key: 'nova', imageId: 'foto', imageLocked: true })
})

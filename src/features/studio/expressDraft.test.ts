import { expect, test } from 'vitest'
import { reconcileExpressSlides, type ExpressSlide } from './expressDraft'

test('mantém a foto da peça reconhecida ao reorganizar e libera associações ambíguas', () => {
  const first: ExpressSlide = { key: 'a', title: 'Título A', body: 'Corpo A', imageId: 'foto-a', framing: 'contain' }
  const second: ExpressSlide = { key: 'b', title: 'Título B', body: 'Corpo B', imageId: 'foto-b' }
  const reorder = reconcileExpressSlides([
    { title: second.title, body: second.body }, { title: first.title, body: first.body },
  ], [first, second], () => 'novo')
  expect(reorder.map(({ key, imageId }) => [key, imageId])).toEqual([['b', 'foto-b'], ['a', 'foto-a']])
  expect(reorder[1].framing).toBe('contain')
  expect(reconcileExpressSlides([first, first], [first], () => 'novo').every(slide => slide.imageId === undefined)).toBe(true)
})

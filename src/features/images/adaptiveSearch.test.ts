import { expect, test } from 'vitest'
import { nextVisualQuery, visualQueryKey } from './adaptiveSearch'
import { campaignContext } from './visualContext'
import { requestFor, evaluateCandidate } from './automaticSearch'

const copy = { title: 'Studio Example launches a new brand identity', role: 'cover' }
const campaign = campaignContext({ title: copy.title, slides: [copy] })
const request = requestFor('test/cover', copy, campaign, .8)!

test('muda de canal quando imagens não têm evidência e não repete permutações', () => {
  const first = nextVisualQuery([request], new Set())!
  const queried = new Set([visualQueryKey(first.kind, first.query)])
  const next = nextVisualQuery([request], queried, { ...first, cause: 'unusable' })!
  expect(first.kind).toBe('images')
  expect(next.kind).toBe('web')
  expect(visualQueryKey('images', 'Example Studio identity')).toBe(visualQueryKey('images', 'identity: Studio Example'))
  expect(nextVisualQuery([], queried)).toBeUndefined()
  const empty = nextVisualQuery([request], queried, { ...first, cause: 'empty' })!
  expect(visualQueryKey(empty.kind, empty.query)).not.toBe(visualQueryKey(first.kind, first.query))
})

test('moldura sem marca explícita não herda imagem de outra obra', () => {
  const source = 'https://www.creativebloq.com/review/picture-frame'
  const copy = { title: 'A new digital art frame for the studio', role: 'cover' }
  const campaign = campaignContext({ title: copy.title, sources: [{ url: source, title: copy.title }], slides: [copy] })
  const request = requestFor('test/frame', copy, campaign, .8)!
  const asset = { url: 'https://cdn.mos.cms.futurecdn.net/object.jpg', page: source, provider: 'original' as const,
    evidence: 'figure' as const, title: copy.title, caption: 'An art frame photographed on a desk', width: 1200, height: 900, ticket: '' }
  expect(evaluateCandidate(asset, request)).toMatchObject({ rejected: true })
  expect(evaluateCandidate({ ...asset, caption: 'A frame from a film' }, request)).toMatchObject({ rejected: true, reason: 'object_not_established' })
  expect(evaluateCandidate({ ...asset, width: 300 }, request)).toMatchObject({ rejected: true, reason: 'resolution_below_480' })
})

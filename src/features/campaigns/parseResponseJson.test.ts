import { expect, it } from 'vitest'
import { importContent, markdownExample } from './contract'

it('restores rich-text JSON without losing sources, slides or visual references', () => {
  const content = importContent(markdownExample)
  content.slides[0].visualContext = { visualCandidates: [{ imageUrl: 'https://example.com/photo.jpg', sourceUrl: 'https://example.com/article', description: 'Detalhe' }] }
  const json = JSON.stringify(content, null, 2)
  const escaped = json.replace(/^ /gm, '&#x20;').replace(/\n/g, '\\\n').replace(/https:/g, 'https\\:').replace(/example\.com/g, 'example\\.com')
  expect(importContent(escaped)).toEqual(content)
})

it('preserves valid JSON escapes and literal entities', () => {
  const content = importContent(markdownExample)
  content.campaign.caption = 'Literal &#x20; e caminho C:\\temp\\foto; "aspas"\nnova linha'
  expect(importContent(JSON.stringify(content))).toEqual(content)
})

it('still rejects incomplete JSON and invalid campaign fields', () => {
  expect(() => importContent('{\\\n&#x20; "schemaVersion": 1,\\\n}')).toThrow()
  expect(() => importContent('{\\\n&#x20; "schemaVersion": 99\\\n}')).toThrow(/campos/)
})

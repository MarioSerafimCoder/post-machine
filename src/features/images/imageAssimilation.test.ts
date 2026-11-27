import { expect, test, vi } from 'vitest'
import { identifiesReference, slideVisualSchema } from './visualContext'
import { parseRecoveredReferences, recoveryPrompt } from './referenceRecovery'
import { newProject } from '../studio/model'
import { rewriteVisualFrame } from '../studio/visualFrames'
import { alternativeWasEdited, hasEditorialAlternative, visualDeliveryIssues } from '../studio/editorialAlternative'
import { validateProject } from '../studio/validation'
import { workerImage } from './searchOrchestrator'

test('separa arquivo inexistente de bytes inválidos no transporte protegido', async () => {
  const transport = vi.spyOn(globalThis, 'fetch')
  try {
    transport.mockResolvedValueOnce(Response.json({ error: 'image_not_found' }, { status: 422 }))
    await expect(workerImage('download', { ticket: 'signed' }, new AbortController().signal)).rejects.toMatchObject({ kind: 'image_not_found' })
    transport.mockResolvedValueOnce(Response.json({ error: 'invalid_image' }, { status: 422 }))
    await expect(workerImage('download', { ticket: 'signed' }, new AbortController().signal)).rejects.toMatchObject({ kind: 'incompatible' })
  } finally { transport.mockRestore() }
})

test('aceita JSON legado, página sem arquivo, vídeo e ausência explícita sem confiar em verificado', () => {
  const legacy = { visualCandidates: [{ sourceUrl: 'https://www.geico.com/work/', imageUrl: 'https://www.geico.com/frame.jpg', description: 'Cena' }] }
  expect(slideVisualSchema.parse(legacy)).toEqual(legacy)
  const page = { visualCandidates: [{ sourceUrl: 'https://www.geico.com/work/', description: 'Cena' }], referenceStatus: 'page_only' }
  expect(slideVisualSchema.parse(page)).toEqual(page)
  expect(slideVisualSchema.parse({ referenceStatus: 'video_only', videoUrl: 'https://www.youtube.com/watch?v=abcdef' }).videoUrl).toBeDefined()
  expect(slideVisualSchema.parse({ referenceStatus: 'unavailable', verified: true })).not.toHaveProperty('verified')
  expect(slideVisualSchema.safeParse({ visualCandidates: [{ sourceUrl: 'http://127.0.0.1/work', description: 'Cena' }] }).success).toBe(false)
})

test('reconhece parâmetros reordenados e variantes efetivamente descobertas sem inventar arquivos', () => {
  const asset = { url: 'https://cdn.example.com/work.jpg?width=1920&height=1080', alternateUrls: ['https://cdn.example.com/work-small.jpg?w=600&amp;h=400'] }
  expect(identifiesReference(asset, 'https://cdn.example.com/work.jpg?height=1080&width=1920')).toBe(true)
  expect(identifiesReference(asset, 'https://cdn.example.com/work-small.jpg?h=400&w=600')).toBe(true)
  expect(identifiesReference(asset, 'https://cdn.example.com/work.jpg?width=1200&height=800')).toBe(false)
  expect(identifiesReference(asset, 'https://cdn.example.com/guessed.jpg')).toBe(false)
})

test('composição preenche o frame, mantém demanda e persiste a pendência até confirmação pertinente', () => {
  const project = newProject()
  const original = { ...project.slides[0], imageBrief: 'Fotografia documental do produto',
    scene: { background: '#ffffff', objects: [{ type: 'Rect', semantic: 'imageFrame', left: 64, top: 64, width: 600, height: 480 }] } }
  const slide = rewriteVisualFrame(original, { mode: 'automatic', reception: { state: 'alternative', failure: 'download', confirmed: false } })
  expect(hasEditorialAlternative(slide)).toBe(true)
  expect(slide.scene.objects.some(object => object.semantic === 'imageFrame' && object.visible !== false)).toBe(false)
  expect(slide.scene.objects.some(object => object.type === 'Image')).toBe(false)
  expect(slide.imageBrief).toBe(original.imageBrief)
  expect(original.scene.objects).toHaveLength(1)
  project.slides = [slide]
  expect(visualDeliveryIssues(project)).toEqual([expect.stringContaining('falta confirmar')])
  const restored = validateProject(JSON.parse(JSON.stringify(project)))
  expect(restored.slides[0].visualChoice?.reception?.failure).toBe('download')
  restored.slides[0].visualChoice!.reception!.confirmed = true
  expect(visualDeliveryIssues(restored)).toEqual([])
  expect(rewriteVisualFrame(slide, { mode: 'manual' })).toMatchObject({ scene: slide.scene })
  const edited = structuredClone(slide.scene)
  expect(alternativeWasEdited(slide.scene, edited)).toBe(false)
  edited.objects.find(object => object.semantic === 'editorialAlternative')!.fill = '#ff0000'
  expect(alternativeWasEdited(slide.scene, edited)).toBe(true)
})

test('recuperação externa conserva identidade e recusa resposta de outro slide', () => {
  const slide = newProject().slides[0]
  const response = { slideId: slide.id, visualContext: { referenceStatus: 'page_only', visualCandidates: [
    { sourceUrl: 'https://www.geico.com/work/', description: 'Objeto específico' },
  ] } }
  expect(parseRecoveredReferences(JSON.stringify(response), slide.id).referenceStatus).toBe('page_only')
  expect(() => parseRecoveredReferences(JSON.stringify(response), 'outro-slide')).toThrow(/identificador/)
  expect(recoveryPrompt(slide)).toContain('Não invente URLs')
  expect(() => parseRecoveredReferences(JSON.stringify({ slideId: slide.id, visualContext: {} }), slide.id)).toThrow(/Informe uma referência/)
})

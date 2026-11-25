import { expect, test } from 'vitest'
import { imageObjects, projectCredits } from './credits'
import { emptySlide, newProject } from '../studio/model'

test('exporta apenas créditos visíveis e mantém as imagens ocultas disponíveis no acervo', () => {
  const project = newProject()
  const image = { type: 'Image', imageCredit: { schemaVersion: 1, provider: 'manual', sourceId: 'foto',
    title: 'Foto da edição', retrievedAt: '2026-11-25T12:00:00Z' } }
  const group = { type: 'Group', objects: [image] }
  project.slides[0].scene.objects = [{ ...group, visible: false }, { type: 'Group', opacity: 0, objects: [group] }]
  project.slides.push(emptySlide())
  project.slides[1].scene.objects = [group, image]
  expect([...imageObjects(project.slides[0].scene.objects)]).toHaveLength(2)
  expect(projectCredits(project, 0)).toBe('')
  expect(projectCredits(project)).toContain('Slides: 2\nFoto da edição')
})

import { expect, test } from 'vitest'
import { exportFingerprint } from './delivery'
import { newProject } from './model'
import { validateProject } from './validation'
import { rememberReview, recallReview } from '../audit/reviewStorage'
import type { AuditReport } from '../audit/contract'

test('registro de exportação sobrevive à validação e ignora timestamps, mas detecta edição e reordenação', async () => {
  const project = newProject()
  project.slides[0].scene.objects = [{ text: 'Editorial', type: 'Textbox', width: 300 }]
  const fingerprint = await exportFingerprint(project)
  project.delivery = { at: new Date().toISOString(), fingerprint, scope: 'all' }
  expect(await exportFingerprint(validateProject(project))).toBe(fingerprint)
  expect(await exportFingerprint({ ...project, updatedAt: '2026-11-24T12:00:00Z' })).toBe(fingerprint)
  expect(await exportFingerprint({ ...project, caption: 'Nova legenda' })).not.toBe(fingerprint)
  expect(await exportFingerprint({ ...project, slides: [...project.slides, newProject().slides[0]] })).not.toBe(fingerprint)
  expect(validateProject(project).delivery).toEqual(project.delivery)
})

test('reutiliza apenas revisão do conteúdo e das regras atuais; cache inválido não aprova um projeto', async () => {
  const project = newProject()
  const report: AuditReport = { projectId: project.id, projectName: project.name, documentVersion: 1,
    projectUpdatedAt: project.updatedAt, analyzedAt: project.updatedAt, totalSlides: 1, rules: [], findings: [], unverifiable: [], corrections: [], status: 'clear' }
  await rememberReview(project, report)
  expect(await recallReview(validateProject(project))).toEqual(report)
  const cacheKey = `post-machine:review:${project.id}`
  const saved = localStorage.getItem(cacheKey)!
  localStorage.setItem(cacheKey, JSON.stringify({ ...JSON.parse(saved), report: { projectId: project.id, findings: [] } }))
  expect(await recallReview(project)).toBeUndefined()
  localStorage.setItem(cacheKey, saved)
  expect(await recallReview({ ...project, brand: { ...project.brand, margin: project.brand.margin + 1 } })).toBeUndefined()
  project.slides[0].scene.background = '#111111'
  expect(await recallReview(project)).toBeUndefined()
  localStorage.setItem(`post-machine:review:${project.id}`, '{invalid')
  expect(await recallReview(project)).toBeUndefined()
})

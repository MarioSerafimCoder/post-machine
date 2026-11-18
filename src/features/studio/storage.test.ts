import { expect, test } from 'vitest'
import { emptySlide, newProject } from './model'
import { BackupLimitError, backupProject } from './storage'

test('recusa criar backup cujo documento ultrapassa o limite da restauração', async () => {
  const project = newProject()
  project.slides = Array.from({ length: 6 }, () => {
    const slide = emptySlide()
    slide.scene.objects = Array.from({ length: 450 }, () => ({ type: 'Textbox', text: 'á'.repeat(4_000) }))
    return slide
  })
  await expect(backupProject(project)).rejects.toThrow(BackupLimitError)
})

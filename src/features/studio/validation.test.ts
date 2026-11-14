import { expect, it } from 'vitest'
import { newProject } from './model'
import { validateProject } from './validation'
it('preserva documentos válidos e rejeita imagens externas, dimensões abusivas e versões desconhecidas', () => {
 const project = newProject(); expect(validateProject(project)).toEqual(project)
 expect(() => validateProject({ ...project, schemaVersion: 99 })).toThrow()
 project.slides[0].scene.objects = [{ type: 'Image', src: 'https://example.com/tracker.png', width: 100, height: 100 }]
 expect(() => validateProject(project)).toThrow('Imagem externa')
 project.slides[0].scene.objects = [{ type: 'Rect', width: 999999, height: 100 }]
 expect(() => validateProject(project)).toThrow('Dimensões')
})

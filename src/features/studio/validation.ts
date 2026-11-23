import { z } from 'zod'
import { brandSchema, type Project } from './model'
import { headlineSessionSchema } from '../headlines/contract'
import { imageCreditSchema } from '../images/contract'
import { availableTemplateRoles, type TemplateRole } from './authorTemplate'
const sceneSchema = z.object({ background: z.string().max(100), version: z.string().optional(), contentImage: z.record(z.string(), z.unknown()).optional(), objects: z.array(z.record(z.string(), z.unknown())).max(500) })
const projectSchema = z.object({ schemaVersion: z.literal(1), id: z.uuid(), name: z.string().max(100), format: z.enum(['portrait', 'square', 'story']), brand: brandSchema, auditSettings: z.object({ requireBrand: z.boolean(), requireLogo: z.boolean(), enforcePalette: z.boolean(), minBodySize: z.number().min(1).max(200), minLargeSize: z.number().min(1).max(200), contrastNormal: z.number().min(1).max(21), contrastLarge: z.number().min(1).max(21) }).optional(), caption: z.string().max(8000).optional(), campaignId: z.uuid().nullable(), campaignUpdatedAt: z.iso.datetime().nullable(), updatedAt: z.iso.datetime(), slides: z.array(z.object({ id: z.uuid(), scene: sceneSchema, layout: z.string().max(100), role: z.string().max(100), imageBrief: z.string().max(8000) })).min(1).max(20), assetEncoding: z.literal('media-v1').optional() })
const linearGradient = z.object({
  type:z.literal('linear'), gradientUnits:z.literal('pixels'),
  coords:z.object({ x1:z.number().min(-4000).max(4000),x2:z.number().min(-4000).max(4000),y1:z.number().min(-4000).max(4000),y2:z.number().min(-4000).max(4000) }),
  colorStops:z.array(z.object({ offset:z.number().min(0).max(1),color:z.string().regex(/^rgba\(\d{1,3},\d{1,3},\d{1,3},(?:0|1|0\.\d+)\)$/) })).min(2).max(8),
})
export function validateProject(input: unknown): Project & { assetEncoding?: 'media-v1' } {
  const project = projectSchema.parse(input)
  if (new Set(project.slides.map(s => s.id)).size !== project.slides.length) throw Error('Slides com identificadores duplicados.')
  let count = 0
  function inspect(value: unknown, depth = 0) {
    if (depth > 12 || ++count > 100000) throw Error('Projeto excede o limite de complexidade.')
    if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Número inválido no projeto.')
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(v => inspect(v, depth + 1)); return }
    const object = value as Record<string, unknown>
    if ('type' in object && !['rect', 'circle', 'line', 'textbox', 'image', 'group', 'activeselection'].includes(String(object.type).toLowerCase())) throw Error('Tipo de elemento não suportado.')
    for (const [key, data] of Object.entries(object)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Propriedade não permitida.')
      if (key === 'src' && (typeof data !== 'string' || !/^(data:image\/(png|jpeg|webp);base64,|asset:[a-f0-9]{64}$)/.test(data))) throw Error('Imagem externa não permitida. Substitua por um arquivo local para evitar falhas de CORS.')
      if (['width', 'height', 'fontSize'].includes(key) && (typeof data !== 'number' || data < 0 || data > 40000)) throw Error('Dimensões inválidas.')
      if (key === 'text' && (typeof data !== 'string' || data.length > 8000)) throw Error('Texto excede o limite.')
      if (key === 'fill' && object.type === 'Rect' && object.semantic === 'editorialGradient') {
        linearGradient.parse(data)
        inspect(Object.fromEntries(Object.entries(data as Record<string,unknown>).filter(([name]) => name !== 'type')),depth+1)
        continue
      }
      if (key === 'headlines') { headlineSessionSchema.parse(data); continue }
      if (key === 'imageCredit') { imageCreditSchema.parse(data); continue }
      if (key === 'templateRole' && data !== undefined && !availableTemplateRoles(String(object.type)).includes(data as TemplateRole)) throw Error('Função de template incompatível com o elemento.')
      inspect(data, depth + 1)
    }
  }
  project.slides.forEach(s => inspect(s.scene))
  if (project.brand.logo && !/^(data:image\/png;base64,|asset:[a-f0-9]{64}$)/.test(project.brand.logo)) throw Error('Logotipo inválido.')
  return project
}

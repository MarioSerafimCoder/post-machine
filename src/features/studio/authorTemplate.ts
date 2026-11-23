import { z } from 'zod'
import { formatNames, type Project } from './model'

export const templateRoles = {
  title: 'Título', subtitle: 'Subtítulo', body: 'Corpo', image: 'Imagem', cta: 'CTA',
  logo: 'Logotipo', signature: 'Assinatura / identificador', decoration: 'Elemento decorativo', fixed: 'Elemento fixo',
} as const
export type TemplateRole = keyof typeof templateRoles

export function availableTemplateRoles(type: string): TemplateRole[] {
  const kind = type.toLowerCase()
  const roles: TemplateRole[] = []
  if (kind === 'textbox') roles.push('title', 'subtitle', 'body', 'cta', 'signature')
  if (kind === 'image' || kind === 'rect') roles.push('image', 'logo')
  return [...roles, 'decoration', 'fixed']
}

export function templateRole(object: { type?: unknown; templateRole?: unknown; semantic?: unknown }): TemplateRole | undefined {
  const roles = availableTemplateRoles(String(object.type))
  const role = object.templateRole ?? ({ imageFrame: 'image', brandLogo: 'logo', brandHandle: 'signature', brand: 'signature' } as Record<string, string>)[String(object.semantic)] ?? object.semantic
  return roles.find(value => value === role)
}

export const templateMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  category: z.string().trim().min(1).max(80),
  brandMode: z.enum(['linked', 'replaceable']),
  familyId: z.uuid(),
})
export type TemplateMetadata = z.infer<typeof templateMetadataSchema>
export type TemplateSummary = TemplateMetadata & {
  id: string
  format: Project['format']
  favorite: boolean
  thumbnail: Blob
  revision: string
}
export type AuthorTemplate = TemplateSummary & { design: Project }

export function copyTemplateDesign(template: AuthorTemplate): Project {
  const { design, name, format } = template
  return {
    ...structuredClone(design),
    id: crypto.randomUUID(), name: `${name.slice(0, 85)} · ${formatNames[format]}`, updatedAt: new Date().toISOString(),
    slides: design.slides.map(slide => ({ ...structuredClone(slide), id: crypto.randomUUID() })),
  }
}

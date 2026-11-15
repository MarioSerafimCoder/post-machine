import { z } from 'zod'

export const dimensions = { portrait: [1080, 1350], square: [1080, 1080], story: [1080, 1920] } as const
export const formatNames = { portrait: 'Retrato', square: 'Quadrado', story: 'Story' }
export type Format = keyof typeof dimensions
export type Scene = { objects: Record<string, unknown>[]; background: string; version?: string; contentImage?: Record<string, unknown> }
export type VisualSlide = { id: string; scene: Scene; layout: string; role: string; imageBrief: string }
export const brandSchema = z.object({ name: z.string().max(100), handle: z.string().max(100), primary: z.string().regex(/^#[\da-f]{6}$/i), secondary: z.string().regex(/^#[\da-f]{6}$/i), background: z.string().regex(/^#[\da-f]{6}$/i), headingFont: z.string().max(80), bodyFont: z.string().max(80), margin: z.number().min(24).max(160), logo: z.string().nullable(), fonts: z.array(z.object({ family: z.string().regex(/^Marca-[a-f0-9]{12}$/), name: z.string().max(100), source: z.string().max(3000000).regex(/^(data:font\/woff2;base64,|asset:[a-f0-9]{64}$)/) })).max(8).default([]) })
export type Brand = z.infer<typeof brandSchema>
export const defaultBrand: Brand = { name: '', handle: '', primary: '#163f35', secondary: '#d8ed91', background: '#f7f5ec', headingFont: 'Inter', bodyFont: 'Inter', margin: 80, logo: null, fonts: [] }
export type Project = { schemaVersion: 1; id: string; name: string; format: Format; slides: VisualSlide[]; brand: Brand; campaignId: string | null; campaignUpdatedAt: string | null; updatedAt: string }
export function emptySlide(): VisualSlide { return { id: crypto.randomUUID(), scene: { objects: [], background: '#f7f5ec' }, layout: 'blank', role: 'content', imageBrief: '' } }
export function newProject(format: Format = 'portrait'): Project { return { schemaVersion: 1, id: crypto.randomUUID(), name: 'Novo projeto', format, slides: [emptySlide()], brand: { ...defaultBrand }, campaignId: null, campaignUpdatedAt: null, updatedAt: new Date().toISOString() } }

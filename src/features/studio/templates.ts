import { Rect, Textbox } from 'fabric'
import type { Draft } from '../campaigns/contract'
import { dimensions, newProject, type Brand, type Format, type Scene, type VisualSlide } from './model'
import './objects'
import { visualQueries } from '../images/automaticSearch'
export const templates = { editorial: 'Capa editorial', photo: 'Capa fotográfica', text: 'Conteúdo textual', split: 'Imagem + conteúdo', comparison: 'Comparativo', cta: 'Encerramento / CTA' }
export type Template = keyof typeof templates
export type Semantic = { title: string; body: string; cta: string; image?: Record<string, unknown> }
export function semantics(scene: Scene): Semantic {
  const objects = scene.objects.flatMap(o => Array.isArray(o.objects) ? [o, ...o.objects as Record<string, unknown>[]] : [o])
  const text = (name: string) => objects.filter(o => o.semantic === name).map(o => String(o.text ?? '')).join('\n')
  return { title: text('title') || objects.filter(o => String(o.type).toLowerCase() === 'textbox').map(o => String(o.text ?? ''))[0] || '', body: text('body'), cta: text('cta'), image: objects.find(o => o.semantic === 'image' && String(o.type).toLowerCase() === 'image') ?? scene.contentImage }
}
export function compose(layout: Template, content: Semantic, brand: Brand, format: Format, role = 'content'): Scene {
  const [w, h] = dimensions[format]; const m = brand.margin; const width = w - 2 * m
  const objects: Record<string, unknown>[] = []
  const rect = (x: number, y: number, rw: number, rh: number, fill: string) => objects.push(new Rect({ left: x, top: y, width: rw, height: rh, fill, strokeWidth: 0, originX: 'left', originY: 'top' }).toObject() as unknown as Record<string, unknown>)
  const text = (semantic: string, value: string, x: number, y: number, tw: number, maxHeight: number, size: number, fill = brand.primary) => {
    if (semantic === 'body') maxHeight = Math.min(maxHeight, h - m - (content.cta ? 164 : 90) - y)
    const o = new Textbox(value, { left: x, top: y, width: tw, fontSize: size, fontFamily: semantic === 'title' ? brand.headingFont : brand.bodyFont, fontWeight: semantic === 'title' ? 'bold' : 'normal', fill, lineHeight: 1.12, originX: 'left', originY: 'top', semantic, maxHeight })
    const min = semantic === 'title' ? 48 : 30
    while (o.height > maxHeight && o.fontSize > min) o.set({ fontSize: Math.max(min, o.fontSize - 2) })
    objects.push(o.toObject() as unknown as Record<string, unknown>)
  }
  const image = (x: number, y: number, iw: number, ih: number) => {
    if (content.image) {
      const o = structuredClone(content.image); const ow = Number(o.width); const oh = Number(o.height)
      const scale = Math.max(iw / ow, ih / oh)
      objects.push({ ...o, left: x, top: y, width: iw / scale, height: ih / scale, scaleX: scale, scaleY: scale, angle: 0, originX: 'left', originY: 'top', semantic: 'image' })
    } else { rect(x, y, iw, ih, brand.secondary); objects[objects.length - 1].semantic = 'imageFrame'; text('imageHint', 'INSIRA SUA IMAGEM', x + 30, y + ih / 2 - 20, iw - 60, 80, 26) }
  }
  rect(m, m, 54, 8, brand.primary)
  if (layout === 'editorial') { text('title', content.title, m, h * .19, width, h * .38, 112); text('body', content.body, m, h * .64, width * .85, h * .20, 38) }
  if (layout === 'photo') { text('title', content.title, m, h * .60, width, h * .19, 70); text('body', content.body, m, h * .81, width, h * .09, 30); image(m, h * .12, width, h * .44) }
  if (layout === 'text') { text('title', content.title, m, h * .14, width, h * .22, 78); rect(m, h * .40, width, 3, brand.primary); text('body', content.body, m, h * .45, width, h * .39, 44) }
  if (layout === 'split') { text('title', content.title, m, h * .13, width, h * .22, 78); image(m, h * .40, width * .46, h * .43); text('body', content.body, m + width * .53, h * .40, width * .47, h * .43, 36) }
  if (layout === 'comparison') {
    text('title', content.title, m, h * .13, width, h * .20, 78)
    rect(m, h * .40, width * .47, h * .43, brand.secondary); rect(m + width * .53, h * .40, width * .47, h * .43, '#ffffff')
    const parts = content.body.split('\n'); const mid = Math.ceil(parts.length / 2)
    text('body', parts.slice(0, mid).join('\n'), m + 26, h * .44, width * .47 - 52, h * .35, 36)
    text('body', parts.slice(mid).join('\n'), m + width * .53 + 26, h * .44, width * .47 - 52, h * .35, 36)
  }
  if (layout === 'cta') { rect(0, 0, w, h, brand.primary); text('title', content.title, m, h * .20, width, h * .29, 96, brand.background); text('body', content.body, m, h * .54, width, h * .24, 40, brand.background) }
  text('cta', content.cta, m, h - m - 140, width, 80, 32, layout === 'cta' ? brand.secondary : brand.primary)
  text('brand', [brand.name, brand.handle].filter(Boolean).join(' / '), m, h - m - 40, width, 50, 24, layout === 'cta' ? brand.background : brand.primary)
  if (brand.logo) objects.push({ type: 'Image', src: brand.logo, left: w - m - 90, top: m, width: 90, height: 90, originX: 'left', originY: 'top', semantic: 'logo' })
  return { background: brand.background, ...(content.image && !['photo', 'split'].includes(layout) ? { contentImage: content.image } : {}), objects: objects.map(o => ({ ...o, slideRole: role })) }
}
export function fromCampaign(draft: Draft, brand: Brand) {
  if (!draft.content) throw Error('Importe e revise o conteúdo antes de criar o design.')
  const project = newProject(draft.content.campaign.format === 'story' ? 'story' : 'portrait')
  project.name = draft.content.campaign.title; project.caption = draft.content.campaign.caption; project.brand = brand; project.campaignId = draft.id; project.campaignUpdatedAt = draft.updatedAt
  project.slides = draft.content.slides.map((s): VisualSlide => {
    const intent = s.layoutType.trim().toLowerCase()
    const textOnly = /^(?:text|textual|somente texto|sem imagem|conteúdo textual)$/.test(intent)
    const search = !textOnly && s.role !== 'cta' && visualQueries({ ...s, role: s.role })
    const layout = search ? s.role === 'cover' ? 'photo' : 'split' : s.role === 'cover' ? 'editorial' : s.role === 'cta' ? 'cta' : 'text'
    const scene = compose(layout, { title: s.title, body: s.body,
      cta: s.role === 'cta' || draft.content!.slides.length === 1 ? draft.content!.campaign.cta : '',
    }, brand, project.format, s.role)
    const title = scene.objects.find(object => object.semantic === 'title')
    if (title && s.headlines) title.headlines = structuredClone(s.headlines)
    return { id: crypto.randomUUID(), layout, role: s.role, imageBrief: s.imageBrief, visualSubtitle: s.subtitle, scene,
      ...(search ? { visualChoice: { mode: 'automatic' as const } } : {}) }
  })
  return project
}

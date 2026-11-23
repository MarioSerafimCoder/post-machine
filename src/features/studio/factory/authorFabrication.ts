import { FabricImage, Rect, StaticCanvas, Textbox, type FabricObject } from 'fabric'
import { inspectCanvas } from '../../audit/rules'
import { defaultSettings } from '../../audit/contract'
import { copyTemplateDesign, templateRole, templateRoles, type AuthorTemplate } from '../authorTemplate'
import { imageForFrame } from '../collections'
import { loadFonts } from '../fonts'
import { replaceTextboxText } from '../editText'
import { dimensions, type Brand, type Scene } from '../model'
import { verifySceneLoaded } from '../sceneIntegrity'
import type { Issue } from './evaluate'
import type { Fabrication, FactoryInput, Proposal } from './fabricate'
import { planSlides, type PlannedSlide } from './planning'
import { fitText } from './typography'
import type { FocalPoint } from '../vision/signals'

const textFields = ['title', 'subtitle', 'body', 'cta'] as const

export function planAuthorImages(template: AuthorTemplate, input: FactoryInput) {
  const [width, height] = dimensions[template.format]
  const frame = template.design.slides[0].scene.objects.find(object => templateRole(object) === 'image')
  const ratio = frame && (Number(frame.width) * Number(frame.scaleX ?? 1)) / (Number(frame.height) * Number(frame.scaleY ?? 1))
  return planSlides(input.slides, input.assets, { width, height, imageRatio: ratio && Number.isFinite(ratio) ? ratio : undefined }, input.visual)
}

async function placeImage(canvas: StaticCanvas, slot: FabricObject, source: Record<string, unknown> | undefined,
  role: 'image' | 'logo', framing: 'cover' | 'contain', signal: AbortSignal, focalPoint?: FocalPoint) {
  const width = slot.width * Math.abs(slot.scaleX)
  const height = slot.height * Math.abs(slot.scaleY)
  if (!(width > 0 && height > 0)) throw Error('O espaço reservado para imagem deve ter largura e altura.')
  const attributes = { angle: slot.angle, flipX: slot.flipX, flipY: slot.flipY, opacity: slot.opacity,
    visible: slot.visible, label: slot.label, templateRole: role, semantic: role }
  const replacement = source ? await FabricImage.fromObject({
    ...imageForFrame(source, [0, 0, width, height], framing, .5, focalPoint), ...attributes,
  }, { signal }) : new Rect({ ...attributes, semantic: 'imageFrame', width, height, fill: 'transparent', strokeWidth: 0 })
  replacement.setPositionByOrigin(slot.getCenterPoint(), 'center', 'center')
  replacement.setCoords()
  const index = canvas.getObjects().indexOf(slot)
  canvas.remove(slot)
  canvas.insertAt(index, replacement)
  slot.dispose()
}

async function logoSource(logo: string, signal: AbortSignal) {
  const image = await FabricImage.fromURL(logo, { signal })
  try { return image.toObject() as unknown as Record<string, unknown> }
  finally { image.dispose() }
}

function selectBrand(template: AuthorTemplate, local: Brand) {
  if (template.brandMode === 'linked') return template.design.brand
  const fonts = new Map([...template.design.brand.fonts, ...local.fonts].map(font => [font.family, font]))
  if (fonts.size > 8) throw Error('As duas marcas usam mais de oito fontes personalizadas. Selecione a identidade vinculada ou libere fontes antes de continuar.')
  return { ...local, fonts: [...fonts.values()] }
}

async function fillSlide(template: AuthorTemplate, project: Proposal['project'], slide: PlannedSlide, index: number, removeImage: boolean, signal: AbortSignal) {
  const source = template.design.slides[0].scene
  const [width, height] = dimensions[project.format]
  const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, renderOnAddRemove: false, enableRetinaScaling: false })
  const id = crypto.randomUUID()
  const layout = 'author-v1'
  const issues: Issue[] = []
  const brand = project.brand
  const original = template.design.brand
  const swapBrand = template.brandMode === 'replaceable'
  const colors = new Map<string, string>([[original.primary, brand.primary], [original.secondary, brand.secondary], [original.background, brand.background]])
  try {
    await canvas.loadFromJSON(source, undefined, { signal })
    verifySceneLoaded(canvas, source)
    if (swapBrand && canvas.backgroundColor === original.background) canvas.backgroundColor = brand.background
    const objects = canvas.getObjects().map(object => ({ object, role: templateRole(object), box: object.getBoundingRect() }))
    const present = new Set(objects.filter(item => item.object.visible).map(item => item.role))
    const missing = textFields.filter(field => slide.content[field]?.trim() && !present.has(field))
    if (missing.length || slide.content.image && !present.has('image')) {
      const names = [...missing.map(field => templateRoles[field]), ...(slide.content.image && !present.has('image') ? ['Imagem'] : [])]
      throw Error(`Slide ${index + 1}. O template precisa de áreas visíveis para ${names.join(', ')}. Edite as funções na biblioteca ou escolha outro template. O conteúdo continua na preparação.`)
    }
    for (const { object, role, box } of objects) {
      signal.throwIfAborted()
      if (role === 'image' && (slide.content.image || removeImage && object instanceof FabricImage)) {
        await placeImage(canvas, object, slide.content.image, 'image', slide.content.framing ?? 'cover', signal, slide.content.focalPoint)
      } else if (role === 'logo' && swapBrand && brand.logo) {
        await placeImage(canvas, object, await logoSource(brand.logo, signal), 'logo', 'contain', signal)
      } else if (object instanceof Textbox && role && (role === 'signature' ? swapBrand : role === 'title' || role === 'subtitle' || role === 'body' || role === 'cta')) {
        const value = role === 'signature' ? brand.handle || brand.name : slide.content[role as typeof textFields[number]] ?? ''
        const scale = Math.max(.01, Math.abs(object.scaleY))
        const boxWidth = object.width
        const after = objects.filter(item => item.object.visible && item.role && item.role !== 'decoration' && item.role !== 'fixed' &&
          item.box.top > box.top + 3 && item.box.left < box.left + box.width && item.box.left + item.box.width > box.left)
        const limit = Math.min(height - brand.margin, ...after.map(item => item.box.top - 12)) - box.top
        const boxHeight = Math.max(1, Math.min(object.maxHeight ?? Infinity, limit))
        object.set({ semantic: role === 'signature' ? 'brand' : role, maxHeight: boxHeight })
        if (role === 'title' && slide.content.headlines) object.headlines = slide.content.headlines
        else delete object.headlines
        if (swapBrand) {
          object.set({ fontFamily: role === 'title' ? brand.headingFont : brand.bodyFont })
          if (typeof object.fill === 'string') object.set({ fill: colors.get(object.fill) ?? object.fill })
        }
        replaceTextboxText(object, value)
        object.set({ width: boxWidth })
        if (value) {
          const minimum = Math.min(object.fontSize, (role === 'title' ? project.auditSettings?.minLargeSize ?? defaultSettings.minLargeSize :
            project.auditSettings?.minBodySize ?? defaultSettings.minBodySize) / scale)
          const measurement = fitText(object, boxWidth, boxHeight / scale, object.fontSize, minimum)
          if (!measurement.fits) issues.push({ kind: 'text', field: role, message: 'O texto excede a caixa. Amplie a área ou divida o conteúdo antes de exportar.' })
        }
        object.setCoords()
      }
    }
    if (slide.content.image) canvas.remove(...canvas.getObjects().filter(object => !object.templateRole && ['imageHint', 'imageDecoration'].includes(object.semantic ?? '')))
    canvas.renderAll()
    for (const finding of inspectCanvas(canvas, id, index + 1, brand, layout, slide.role, project.auditSettings)) {
      if (finding.severity === 'info' || finding.ruleId === 'TEXT_OVERFLOW') continue
      issues.push({ kind: finding.category === 'image' ? 'image' : finding.category === 'typography' ? 'text' : 'layout', message: finding.message })
    }
    return { visual: { id, layout, role: slide.role, imageBrief: slide.content.imageBrief ?? '', scene: canvas.toObject() as Scene }, issues }
  } finally { await canvas.dispose() }
}

export async function fabricateAuthorTemplate(template: AuthorTemplate, input: FactoryInput, signal: AbortSignal, progress: (complete: number) => void): Promise<Fabrication> {
  if (template.format !== input.format) throw Error('Selecione um template com o formato indicado para a fabricação.')
  const start = performance.now()
  const brand = selectBrand(template, input.brand)
  await loadFonts(brand)
  const slides = planAuthorImages(template, input)
  const project = { ...copyTemplateDesign(template), brand, slides: [] as Proposal['project']['slides'] }
  const proposal: Proposal = { treatment: 'balanced', project, details: [] }
  for (const [index, slide] of slides.entries()) {
    const { visual, issues } = await fillSlide(template, project, slide, index, input.slides[index].imageId === null, signal)
    project.slides.push(visual)
    proposal.details.push({ composition: 0, issues })
    progress(index + 1)
  }
  signal.throwIfAborted()
  return { proposals: [proposal], slides, collection: template.name, elapsed: performance.now() - start, candidates: slides.length }
}

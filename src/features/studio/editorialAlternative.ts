import { Rect, Textbox, type FabricObject } from 'fabric'
import type { Project, Scene, VisualSlide } from './model'
import { needsImage } from '../images/visualContext'

export const alternativeSemantic = 'editorialAlternative'

export function requiresDocumentary(slide: VisualSlide, hasSources = false) {
  return slide.visualContext?.documentaryRequired ?? !!(hasSources && (slide.imageBrief.trim() || slide.visualContext) || slide.visualContext?.visualCandidates?.length ||
    slide.visualContext?.preferredSourceUrls?.length || slide.visualContext?.videoUrl ||
    /documental|documentária|peça real|foto real|fotograma|still|captura de tela|reprodução/i.test(
      [slide.imageBrief, slide.visualContext?.imageType].filter(Boolean).join(' ')))
}

// Original local composition. It depicts no person, product, screenshot or film frame.
export function editorialObjects(box: readonly [number, number, number, number], seed: string): FabricObject[] {
  const [left, top, width, height] = box
  const rect = (x: number, y: number, w: number, h: number, fill: string) => new Rect({
    left: left + x * width, top: top + y * height, width: w * width, height: h * height,
    fill, strokeWidth: 0, originX: 'left', originY: 'top', semantic: alternativeSemantic,
  })
  const variation = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0) % 3
  const objects: FabricObject[] = [rect(0, 0, 1, 1, '#172832'), rect(.08, .12, .035, .76, '#ff554b'),
    rect(.18, .12, .72, .12, '#e9e3d5'), rect(.18, .31, .42 + variation * .1, .055, '#ff554b')]
  for (let index = 0; index < 5; index++) objects.push(rect(.18, .45 + index * .064, .72 - ((index + variation) % 3) * .14, .018, '#778f9a'))
  objects.push(new Textbox('EDITORIAL', { left: left + width * .18, top: top + height * .86,
    width: width * .72, fontFamily: 'Inter', fontSize: 24,
    fill: '#e9e3d5', fontWeight: 'bold', originX: 'left', originY: 'top', semantic: alternativeSemantic }))
  return objects
}

export function hasEditorialAlternative(slide: VisualSlide) {
  return slide.scene.objects.some(object => object.semantic === alternativeSemantic && object.visible !== false)
}

export function alternativeWasEdited(before: Scene, after: Scene) {
  const visual = (scene: Scene) => scene.objects.filter(object => object.semantic === alternativeSemantic).map(object =>
    ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'fill', 'stroke', 'strokeWidth', 'opacity', 'visible', 'text', 'fontSize', 'fontFamily']
      .map(key => object[key]))
  return before.objects.some(object => object.semantic === alternativeSemantic) && JSON.stringify(visual(before)) !== JSON.stringify(visual(after))
}

export function coverEmptyVisual(slide: VisualSlide): VisualSlide {
  const frame = slide.scene.objects.find(object => object.semantic === 'imageFrame' && object.visible !== false)
  if (!frame || slide.scene.objects.some(object => object.semantic === 'image' && String(object.type).toLowerCase() === 'image')) return slide
  const box = [Number(frame.left ?? 0), Number(frame.top ?? 0), Number(frame.width) * Number(frame.scaleX ?? 1),
    Number(frame.height) * Number(frame.scaleY ?? 1)] as const
  if (!box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return slide
  const graphic = editorialObjects(box, slide.id).map(object => object.toObject(['semantic']) as Record<string, unknown>)
  const objects = slide.scene.objects.flatMap(object => object === frame ? [{ ...frame, visible: false }, ...graphic] :
    object.semantic === 'imageHint' || object.semantic === alternativeSemantic ? [] : [object])
  return { ...slide, scene: { ...slide.scene, objects }, visualChoice: { mode: 'manual', ...slide.visualChoice,
    reception: slide.visualChoice?.reception ?? { state: 'alternative', documentaryRequired: requiresDocumentary(slide), confirmed: false } } }
}

export function visualDeliveryIssues(project: Project, current?: number) {
  return project.slides.flatMap((slide, index) => {
    if (current !== undefined && index !== current) return []
    const hasFile = slide.scene.objects.some(object => object.semantic === 'image' && String(object.type).toLowerCase() === 'image' && object.visible !== false)
    const alternative = hasEditorialAlternative(slide)
    const emptyFrame = slide.scene.objects.some(object => object.semantic === 'imageFrame' && object.visible !== false)
    const demand = needsImage({ title: 'Conteúdo do slide', imageBrief: slide.imageBrief, role: slide.role, visualContext: slide.visualContext })
    const prefix = `Slide ${index + 1} · `
    if (emptyFrame || demand && slide.visualChoice?.mode === 'automatic' && !hasFile && !alternative)
      return [prefix + 'a área visual ainda não recebeu arquivo válido ou composição editorial.']
    if (alternative && slide.visualChoice?.reception?.documentaryRequired !== false && !slide.visualChoice?.reception?.confirmed)
      return [prefix + 'alternativa editorial disponível; falta confirmar sua pertinência ou fornecer a imagem documental.']
    if (hasFile && (slide.visualChoice?.reviewRequired && requiresDocumentary(slide) || slide.visualChoice?.match?.referenceReview && slide.visualChoice.decision !== 'approved'))
      return [prefix + 'a correspondência documental da imagem precisa de confirmação.']
    return []
  })
}

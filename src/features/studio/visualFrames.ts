import { FabricImage, Rect, type Canvas } from 'fabric'
import { requestFor, type AutomaticImage, type VisualChoice } from '../images/automaticSearch'
import { campaignContext } from '../images/visualContext'
import { imageForFrame } from './collections'
import { dimensions, type Project, type Scene, type VisualSlide } from './model'
import { semantics } from './templates'

export function frameImage(scene: Scene) {
  return scene.objects.find(object => object.semantic === 'image' && String(object.type).toLowerCase() === 'image')
}

function frame(scene: Scene) {
  return scene.objects.find(object => object.semantic === 'imageFrame' || object.semantic === 'visualSearchFrame') ?? frameImage(scene)
}

export function projectVisualContext(project: Project) {
  const slides = project.slides.map(slideCopy)
  const context = campaignContext({
    title: project.importedContent?.campaign.title ?? project.editorialSource?.title ?? '',
    caption: project.caption, article: project.editorialSource,
    sources: project.editorialReferences ?? project.importedContent?.sources,
    visual: project.importedContent?.campaign.visualContext, slides,
  })
  return { slides, context }
}

function slideCopy(slide: VisualSlide) {
  const copy = semantics(slide.scene)
  return { ...copy, imageBrief: slide.imageBrief, role: slide.role, subtitle: copy.subtitle || slide.visualSubtitle,
    visualContext: slide.visualContext }
}

export function frameRequest(project: Project, slide: VisualSlide, research = projectVisualContext(project), manual = false) {
  const reserved = frame(slide.scene)
  const [width, height] = dimensions[project.format]
  const ratio = reserved
    ? (Number(reserved.width) * Number(reserved.scaleX ?? 1)) / (Number(reserved.height) * Number(reserved.scaleY ?? 1))
    : manual ? width / height : 0
  if (!Number.isFinite(ratio) || ratio <= 0) return
  const index = project.slides.findIndex(item => item.id === slide.id)
  const copy = research.slides[index]
  if (!copy) return
  const neighbors = research.slides.slice(Math.max(0, index - 1), index + 2).filter(item => item !== copy)
  return requestFor(project.id + '/' + slide.id, copy, research.context, ratio, slide.visualChoice?.revision, neighbors, slide.visualChoice?.discarded, manual)
}

export function rewriteVisualFrame(slide: VisualSlide, choice: VisualChoice, suggestion?: AutomaticImage, hidePlaceholder = choice.mode === 'none'): VisualSlide {
  const reserved = frame(slide.scene)
  if (!reserved || (choice.mode !== 'automatic' && choice.mode !== 'none')) return { ...slide, visualChoice: choice }
  const remove = choice.mode === 'none' || !suggestion
  const box = [Number(reserved.left ?? 0), Number(reserved.top ?? 0), Number(reserved.width) * Number(reserved.scaleX ?? 1),
    Number(reserved.height) * Number(reserved.scaleY ?? 1)] as const
  const placeholder = String(reserved.type).toLowerCase() === 'image'
    ? new Rect({ left: box[0], top: box[1], width: box[2], height: box[3], strokeWidth: 0, fill: '#efefef',
      originX: 'left', originY: 'top', semantic: 'imageFrame' }).toObject() as unknown as Record<string, unknown> : reserved
  const objects = slide.scene.objects.flatMap(object => {
    if (object === reserved) return remove ? [{ ...placeholder, semantic: 'imageFrame', visible: !hidePlaceholder }] : [
      { ...placeholder, semantic: 'visualSearchFrame', visible: false },
      imageForFrame(suggestion.object, [...box], 'cover', .5, suggestion.focalPoint),
    ]
    if (object.semantic === 'image' || object.semantic === 'imageHint' || object.semantic === 'imageDecoration') return []
    return [object]
  })
  const scene = { ...slide.scene, objects }
  delete scene.contentImage
  return { ...slide, visualChoice: choice, scene }
}

export function imageWasEdited(previous: Scene, next: Scene) {
  const before = frameImage(previous)
  const after = frameImage(next)
  return ['src', 'left', 'top', 'scaleX', 'scaleY', 'cropX', 'cropY', 'width', 'height', 'angle', 'visible']
    .some(key => before?.[key] !== after?.[key]) || JSON.stringify(before?.imageCredit) !== JSON.stringify(after?.imageCredit)
}

export function updateCanvasVisual(canvas: Canvas, next: Scene, suggestion?: AutomaticImage) {
  const objects = canvas.getObjects()
  const current = objects.find(object => object.semantic === 'imageFrame' || object.semantic === 'visualSearchFrame')
  if (!current) return false
  const frame = next.objects.find(object => object.semantic === 'imageFrame' || object.semantic === 'visualSearchFrame')
  const picture = frameImage(next)
  if (!frame || (suggestion && !picture)) return false
  current.set({ semantic: frame.semantic as string, visible: frame.visible !== false })
  const replaced = objects.filter(object => ['image', 'imageHint', 'imageDecoration'].includes(object.semantic ?? ''))
  canvas.remove(...replaced)
  replaced.forEach(object => object.dispose())
  if (suggestion && picture) {
    const properties = { ...picture }
    delete properties.type
    const rendered = new FabricImage(suggestion.element, properties)
    canvas.insertAt(canvas.getObjects().indexOf(current) + 1, rendered)
    rendered.setCoords()
  }
  canvas.requestRenderAll()
  return true
}

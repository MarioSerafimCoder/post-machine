import { Rect } from 'fabric'
import { requestFor } from '../images/useAutomaticImages'
import { visualQueries, type AutomaticImage, type VisualChoice } from '../images/automaticSearch'
import { imageForFrame } from './collections'
import type { Project, Scene, VisualSlide } from './model'
import { semantics } from './templates'

export function frameImage(scene: Scene) {
  return scene.objects.find(object => object.semantic === 'image' && String(object.type).toLowerCase() === 'image')
}

function frame(scene: Scene) {
  return scene.objects.find(object => object.semantic === 'imageFrame' || object.semantic === 'visualSearchFrame') ?? frameImage(scene)
}

export function frameRequest(project: Project, slide: VisualSlide) {
  const reserved = frame(slide.scene)
  if (!reserved) return
  const ratio = (Number(reserved.width) * Number(reserved.scaleX ?? 1)) / (Number(reserved.height) * Number(reserved.scaleY ?? 1))
  if (!Number.isFinite(ratio) || ratio <= 0) return
  const query = visualQueries({ ...semantics(slide.scene), imageBrief: slide.imageBrief, role: slide.role, campaign: project.name,
    subtitle: slide.scene.objects.filter(object => object.semantic === 'subtitle').map(object => String(object.text ?? '')).join(' ') || slide.visualSubtitle,
    sourcePage: slide.role === 'cover' ? project.editorialSource?.url : undefined,
    sourceImage: slide.role === 'cover' ? project.editorialSource?.imageUrl : undefined,
    allowIllustration: !!project.editorialSource,
    ratio })
  return query ? requestFor(project.id + '/' + slide.id, query, slide.visualChoice?.revision) : undefined
}

export function rewriteVisualFrame(slide: VisualSlide, choice: VisualChoice, suggestion?: AutomaticImage): VisualSlide {
  const reserved = frame(slide.scene)
  if (!reserved || (choice.mode !== 'automatic' && choice.mode !== 'none')) return { ...slide, visualChoice: choice }
  const remove = choice.mode === 'none' || !suggestion
  const box = [Number(reserved.left ?? 0), Number(reserved.top ?? 0), Number(reserved.width) * Number(reserved.scaleX ?? 1),
    Number(reserved.height) * Number(reserved.scaleY ?? 1)] as const
  const placeholder = String(reserved.type).toLowerCase() === 'image'
    ? new Rect({ left: box[0], top: box[1], width: box[2], height: box[3], strokeWidth: 0, fill: '#efefef',
      originX: 'left', originY: 'top', semantic: 'imageFrame' }).toObject() as unknown as Record<string, unknown> : reserved
  const objects = slide.scene.objects.flatMap(object => {
    if (object === reserved) return remove ? [{ ...placeholder, semantic: 'imageFrame', visible: true }] : [
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
    .some(key => before?.[key] !== after?.[key])
}

import { FabricImage, Point, Rect, StaticCanvas, Textbox } from 'fabric'
import { defaultSettings } from '../audit/contract'
import { templateRole } from './authorTemplate'
import { fitText } from './factory/typography'
import { loadFonts } from './fonts'
import { newProjectIdentity, dimensions, formatNames, type Format, type Project, type Scene } from './model'
import { verifySceneLoaded } from './sceneIntegrity'
import './objects'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export async function adaptLayout(source: Project, format: Format, signal?: AbortSignal, progress?: (complete: number) => void) {
  if (source.format === format) throw Error('Escolha um formato diferente do original.')
  await loadFonts(source.brand)
  const [width, oldHeight] = dimensions[source.format]
  const [, height] = dimensions[format]
  const margin = source.brand.margin
  const ratio = (height - margin * 2) / (oldHeight - margin * 2)
  const y = (value: number) => value < margin ? value : value > oldHeight - margin ? height - (oldHeight - value) : margin + (value - margin) * ratio
  const project: Project = {
    ...source, ...newProjectIdentity(), name: `${source.name.slice(0, 85)} · ${formatNames[format]}`,
    format, slides: [],
  }
  const conservative: number[] = []
  const settings = source.auditSettings ?? defaultSettings
  for (const [index, slide] of source.slides.entries()) {
    signal?.throwIfAborted()
    const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, renderOnAddRemove: false, enableRetinaScaling: false })
    try {
      await canvas.loadFromJSON(slide.scene, undefined, { signal })
      verifySceneLoaded(canvas, slide.scene)
      const nodes = canvas.getObjects().map(object => ({ object, box: object.getBoundingRect(), role: templateRole(object) }))
      const boxes = nodes.map(({ box, role }) => {
        const bottom = box.top + box.height
        const footer = (role === 'cta' || role === 'signature' || role === 'logo') && box.top > oldHeight * .62
        return { top: footer ? height - (oldHeight - box.top) : y(box.top), bottom: footer ? height - (oldHeight - bottom) : y(bottom) }
      })
      for (const [position, { object, box, role }] of nodes.entries()) {
        const anchor = boxes[position]
        const simple = !object.angle && !object.skewX && !object.skewY
        const cover = simple && object instanceof Rect && box.left <= 1 && box.top <= 1 &&
          box.width + box.left >= width - 1 && box.height + box.top >= oldHeight - 1
        const bleed = box.top < margin - 1 || box.top + box.height > oldHeight - margin + 1
        const bottomLimit = bleed ? height : height - margin
        let left = box.left
        let top = anchor.top
        const next = nodes.flatMap((node, other) => node.object.visible &&
          ['title', 'subtitle', 'body', 'cta', 'image', 'logo', 'signature'].includes(node.role ?? '') &&
          node.box.top >= box.top + box.height - 1 &&
          node.box.left < box.left + box.width - 1 && node.box.left + node.box.width > box.left + 1
          ? [boxes[other].top - Math.min(18, Math.max(0, node.box.top - box.top - box.height))] : [])
        const room = Math.max(1, Math.min(bottomLimit, ...next) - top)
        if (cover) object.set({ scaleY: object.scaleY * height / oldHeight })
        else if (simple && object instanceof Textbox && role && !['fixed', 'decoration'].includes(role)) {
          const scale = Math.max(.01, Math.abs(object.scaleY))
          const bound = Math.max(1, Math.min(room, object.maxHeight ? object.maxHeight * Math.min(1, ratio) : Infinity))
          const minimum = Math.min(object.fontSize, (role === 'title' ? settings.minLargeSize : settings.minBodySize) / scale)
          fitText(object, object.width, bound / scale, object.fontSize, minimum)
          object.set({ maxHeight: bound })
        } else if (simple && object instanceof FabricImage && role === 'image' && box.width > 0 && box.height > 0 && !object.clipPath && (!object.stroke || !object.strokeWidth)) {
          const { width: rawWidth, height: rawHeight } = object.getOriginalSize()
          const newHeight = Math.min(room, Math.max(box.height * .55, anchor.bottom - anchor.top))
          const scale = Math.max(box.width / rawWidth, newHeight / rawHeight)
          const cropWidth = box.width / scale
          const cropHeight = newHeight / scale
          const retention = Math.min(cropWidth, object.width) * Math.min(cropHeight, object.height) / (object.width * object.height)
          if (retention >= .7) {
            object.set({
              scaleX: scale, scaleY: scale, width: cropWidth, height: cropHeight,
              cropX: clamp(object.cropX + (object.width - cropWidth) / 2, 0, Math.max(0, rawWidth - cropWidth)),
              cropY: clamp(object.cropY + (object.height - cropHeight) / 2, 0, Math.max(0, rawHeight - cropHeight)),
            })
          } else {
            const factor = Math.min(1, newHeight / box.height)
            object.set({ scaleX: object.scaleX * factor, scaleY: object.scaleY * factor })
            left += (box.width - box.width * factor) / 2
          }
        } else if (simple && object instanceof Rect && role === 'image' && box.height > 0) {
          object.set({ scaleY: object.scaleY * Math.min(room, anchor.bottom - anchor.top) / box.height })
        } else {
          if (!role && object.visible && conservative.at(-1) !== index + 1) conservative.push(index + 1)
          if (box.height > 0) {
            const available = role ? room : bleed ? height : height - margin * 2
            const scale = Math.min(1, available / box.height)
            object.set({ scaleX: object.scaleX * scale, scaleY: object.scaleY * scale })
          }
        }
        object.setCoords()
        const adjusted = object.getBoundingRect()
        if (!cover && box.top >= -1 && box.top + box.height <= oldHeight + 1) {
          if (!bleed && adjusted.height <= height - margin * 2) top = clamp(top, margin, height - margin - adjusted.height)
          else top = clamp(top, 0, Math.max(0, height - adjusted.height))
        }
        const delta = new Point(left - adjusted.left, top - adjusted.top)
        object.setXY(object.getXY().add(delta))
        object.setCoords()
      }
      const scene = canvas.toObject() as Scene
      if (slide.scene.contentImage) scene.contentImage = structuredClone(slide.scene.contentImage)
      const visualChoice = slide.visualChoice?.mode === 'automatic'
        ? { ...slide.visualChoice, mode: slide.visualChoice.match ? 'manual' as const : 'none' as const }
        : slide.visualChoice
      project.slides.push({ ...slide, id: crypto.randomUUID(), scene, visualChoice })
      progress?.(index + 1)
    } finally { await canvas.dispose() }
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
  signal?.throwIfAborted()
  return { project, conservative }
}

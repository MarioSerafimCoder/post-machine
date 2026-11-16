import { ActiveSelection, Canvas, Circle, FabricObject, Group, Line, Rect, Textbox } from 'fabric'
import type { Scene } from './model'
import type { HeadlineSession } from '../headlines/contract'
import type { ImageCredit } from '../images/contract'

declare module 'fabric' {
  interface FabricObject { semantic?: string; assetId?: string; maxHeight?: number; label?: string; headlines?: HeadlineSession; imageCredit?: ImageCredit }
  interface SerializedObjectProps { semantic?: string; assetId?: string; maxHeight?: number; label?: string; headlines?: HeadlineSession; imageCredit?: ImageCredit }
}
FabricObject.customProperties = ['semantic', 'assetId', 'maxHeight', 'label', 'headlines', 'imageCredit']
export const sceneOf = (canvas: Canvas): Scene => canvas.toObject() as Scene
export function addObject(canvas: Canvas, type: 'title' | 'text' | 'rect' | 'circle' | 'line', color = '#111111') {
  const common = { left: 100, top: 120, originX: 'left' as const, originY: 'top' as const, fill: color }
  const object = type === 'title' || type === 'text' ? new Textbox(type === 'title' ? 'Seu título aqui' : 'Escreva sua mensagem.', { ...common, width: 800, semantic: type === 'title' ? 'title' : 'body', fontFamily: 'Inter', fontSize: type === 'title' ? 84 : 42, fontWeight: type === 'title' ? 'bold' : 'normal' })
    : type === 'rect' ? new Rect({ ...common, width: 360, height: 240 }) : type === 'circle' ? new Circle({ ...common, radius: 120 }) : new Line([0, 0, 500, 0], { ...common, stroke: color, strokeWidth: 6 })
  canvas.add(object); canvas.setActiveObject(object); canvas.requestRenderAll()
}
export async function duplicate(canvas: Canvas) {
  const source = canvas.getActiveObject(); if (!source) return
  const copy = await source.clone()
  if (canvas.disposed || canvas.destroyed) { copy.dispose(); return }
  copy.set({ left: source.left + 24, top: source.top + 24 }); canvas.add(copy); canvas.setActiveObject(copy); canvas.requestRenderAll()
}
export function groupSelection(canvas: Canvas) {
  const selected = canvas.getActiveObjects()
  if (selected.length > 1) { canvas.discardActiveObject(); canvas.remove(...selected); const group = new Group(selected); canvas.add(group); canvas.setActiveObject(group) }
  else if (selected[0] instanceof Group && !(selected[0] instanceof ActiveSelection)) { const group = selected[0]; const children = group.removeAll(); canvas.remove(group); canvas.add(...children); canvas.setActiveObject(new ActiveSelection(children, { canvas })) }
  canvas.requestRenderAll()
}
export function align(canvas: Canvas, direction: 'left' | 'center' | 'top' | 'distribute') {
  const selected = canvas.getActiveObjects(); canvas.discardActiveObject()
  if (direction === 'distribute' && selected.length >= 3) {
    const sorted = selected.sort((a, b) => a.left - b.left)
    const first = sorted[0].left; const step = (sorted.at(-1)!.left - first) / (sorted.length - 1)
    sorted.forEach((o, i) => o.set({ left: first + i * step }))
  } else selected.forEach(o => { if (direction === 'left') o.set({ left: 80 }); if (direction === 'top') o.set({ top: 80 }); if (direction === 'center') o.set({ left: (1080 - o.getScaledWidth()) / 2 }) })
  selected.forEach(o => o.setCoords()); canvas.requestRenderAll()
}

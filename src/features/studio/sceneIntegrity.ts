import { Group, type StaticCanvas } from 'fabric'
import type { Scene } from './model'

export function verifySceneLoaded(canvas: StaticCanvas, scene: Scene) {
  // Fabric 7 can drop an object whose local source fails to decode.
  const expected = (objects: Scene['objects']): number => objects.reduce((count, object) => count + 1 + (Array.isArray(object.objects) ? expected(object.objects) : 0), 0)
  const loaded = (objects: ReturnType<StaticCanvas['getObjects']>): number => objects.reduce((count, object) => count + 1 + (object instanceof Group ? loaded(object.getObjects()) : 0), 0)
  if (expected(scene.objects) !== loaded(canvas.getObjects())) throw Error('O slide tem elementos que não puderam ser carregados. Confira a Auditoria ou restaure um backup.')
}

import { fontChoices } from './fonts'
import type { Brand } from './model'
import { Canvas, FabricImage, Textbox } from 'fabric'
import { cropImage } from './images'
import { align, duplicate, groupSelection } from './objects'

export function Properties({ canvas, changed, brand }: { brand: Brand; canvas: Canvas | null; changed: () => void }) {
  const object = canvas?.getActiveObject()
  if (!canvas || !object) return <aside className="studio-properties"><h3>Propriedades</h3><p>Selecione um elemento no canvas ou em Camadas. Duplo clique para editar texto.</p><p>Shift + clique seleciona vários elementos.</p></aside>
  function set(values: Record<string, unknown>) { object!.set(values); object!.setCoords(); canvas!.requestRenderAll(); changed() }
  const number = (label: string, key: string, value: number, min = -10000, max = 10000, step = 1) => <label>{label}<input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) set({ [key]: Math.max(min, Math.min(max, n)) }) }} /></label>
  const act = (fn: () => void) => { fn(); canvas.requestRenderAll(); changed() }
  return <aside className="studio-properties"><h3>Propriedades</h3><p className="muted">{object.type}</p>
    {object instanceof Textbox && <>
      <label>Texto do elemento<textarea value={object.text} maxLength={8000} onChange={e => set({ text: e.target.value })} /></label>
      <label>Fonte<select aria-label="Fonte" value={object.fontFamily} onChange={e => set({ fontFamily: e.target.value })}>{fontChoices(brand).map(font => <option key={font.family} value={font.family}>{font.name}</option>)}</select></label>
      <label>Peso<select value={String(object.fontWeight)} onChange={e => set({ fontWeight: e.target.value })}><option value="normal">Regular</option><option value="bold">Negrito</option></select></label>
      {number('Tamanho da fonte', 'fontSize', object.fontSize, 12, 300)}
      <label>Alinhamento<select value={object.textAlign} onChange={e => set({ textAlign: e.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
      {number('Entrelinha', 'lineHeight', object.lineHeight, .7, 3, .05)}{number('Espaçamento', 'charSpacing', object.charSpacing, -100, 1000)}
    </>}
    <div className="property-grid">{number('X', 'left', object.left)}{number('Y', 'top', object.top)}{number('Rotação', 'angle', object.angle, -360, 360)}{number('Opacidade', 'opacity', object.opacity, 0, 1, .05)}{number('Largura', 'width', object.width, 1, 5000)}{!(object instanceof Textbox) && number('Altura', 'height', object.height, 1, 5000)}</div>
    {!(object instanceof FabricImage) && <label>Cor<input type="color" value={typeof object.fill === 'string' && /^#[\da-f]{6}$/i.test(object.fill) ? object.fill : brand.primary} onChange={e => set({ fill: e.target.value })} /></label>}
    <label>Cor da borda<input type="color" value={typeof object.stroke === 'string' ? object.stroke : brand.primary} onChange={e => set({ stroke: e.target.value })} /></label>{number('Espessura da borda', 'strokeWidth', object.strokeWidth, 0, 100)}
    {object instanceof FabricImage && <><button onClick={() => act(() => cropImage(object, 1))}>Recortar quadrado</button><button onClick={() => act(() => cropImage(object, 4 / 3))}>Recortar 4:3</button>{number('Recorte X', 'cropX', object.cropX, 0, object.getOriginalSize().width - object.width)}{number('Recorte Y', 'cropY', object.cropY, 0, object.getOriginalSize().height - object.height)}</>}
    <button onClick={() => void duplicate(canvas).then(changed)}>Duplicar elemento</button>
    <button onClick={() => act(() => { canvas.remove(...canvas.getActiveObjects()); canvas.discardActiveObject() })}>Excluir elemento</button>
    <button onClick={() => set({ lockMovementX: !object.lockMovementX, lockMovementY: !object.lockMovementX, lockScalingX: !object.lockMovementX, lockScalingY: !object.lockMovementX, lockRotation: !object.lockMovementX })}>{object.lockMovementX ? 'Desbloquear' : 'Bloquear'}</button>
    <button onClick={() => act(() => canvas.bringObjectForward(object))}>Para frente</button><button onClick={() => act(() => canvas.sendObjectBackwards(object))}>Para trás</button>
    <button onClick={() => act(() => groupSelection(canvas))}>Agrupar / desagrupar</button>
    <button onClick={() => act(() => align(canvas, 'left'))}>Alinhar à esquerda</button><button onClick={() => act(() => align(canvas, 'center'))}>Centralizar</button><button onClick={() => act(() => align(canvas, 'top'))}>Alinhar ao topo</button><button disabled={canvas.getActiveObjects().length < 3} onClick={() => act(() => align(canvas, 'distribute'))}>Distribuir horizontalmente</button>
  </aside>
}

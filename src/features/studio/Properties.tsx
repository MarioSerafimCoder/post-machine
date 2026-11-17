import { useRef, type ReactNode } from 'react'
import { ActiveSelection, Canvas, Color, FabricImage, Gradient, Group, Textbox } from 'fabric'
import { fontChoices } from './fonts'
import type { Brand } from './model'
import { cropImage, restoreFraming } from './images'
import { editorialGradient } from './premium'
import { align, duplicate, groupSelection } from './objects'

export function Properties({ canvas, changed, brand, replaceImage, children }: {
  brand: Brand; canvas: Canvas | null; changed: () => void; replaceImage: () => void; children?: ReactNode
}) {
  const textField = useRef<HTMLTextAreaElement>(null)
  const drag = useRef<{ x: number; y: number; cropX: number; cropY: number }>(null)
  const object = canvas?.getActiveObject()
  if (!canvas || !object) return null
  const text = object instanceof Textbox ? object : undefined
  const image = object instanceof FabricImage ? object : undefined
  const multi = object instanceof ActiveSelection
  const original = image?.getOriginalSize()
  const maxX = original && image ? Math.max(0, original.width - image.width) : 0
  const maxY = original && image ? Math.max(0, original.height - image.height) : 0
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  function set(values: Record<string, unknown>) {
    object!.set(values)
    text?.initDimensions()
    object!.setCoords()
    canvas!.requestRenderAll()
    changed()
  }
  const numeric = (label: string, value: number, update: (value: number) => void, min = -10000, max = 10000, step = 1) =>
    <label>{label}<input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step}
      onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n)) update(clamp(n,min,max)) }} /></label>
  const number = (label: string, key: string, value: number, min?: number, max?: number, step?: number) =>
    numeric(label, value, n => set({ [key]: n }), min, max, step)
  const color = (label: string, key: 'fill' | 'stroke') =>
    <label>{label}<input type="color" value={typeof object[key] === 'string' && /^#[\da-f]{6}$/i.test(object[key]) ? object[key] : brand.primary}
      onChange={event => set({ [key]: event.target.value })} /></label>
  const border = <>{color('Cor da borda','stroke')}{number('Espessura da borda','strokeWidth',object.strokeWidth,0,100)}</>
  const act = (fn: () => void) => { fn(); canvas.requestRenderAll(); changed() }
  const scaleImage = (scale: number) => set({ scaleX: clamp(scale,.02,10), scaleY: clamp(scale,.02,10) })
  const locked = object.lockMovementX
  const gradient = object.fill instanceof Gradient && object.semantic === 'editorialGradient' ? object.fill : undefined
  const stops = gradient?.colorStops ?? []
  const end = new Color(stops.at(-1)?.color ?? '#000000')
  const gradientOptions = gradient ? {
    strength:end.getAlpha(), start:stops[1]?.offset ?? .38, finish:stops[4]?.offset ?? 1, color:'#' + end.toHex(),
    angle:Math.atan2((gradient.coords.x2 - gradient.coords.x1)/object.width,(gradient.coords.y2 - gradient.coords.y1)/object.height)*180/Math.PI,
  } : undefined
  function updateGradient(patch: Partial<NonNullable<typeof gradientOptions>>) {
    if (gradientOptions && object) set({ fill:editorialGradient(object.width,object.height,{...gradientOptions,...patch}) })
  }
  function highlight() {
    if (!text) return
    const field = textField.current
    const start = field && field.selectionStart !== field.selectionEnd
      ? text.graphemeSplit(text.text.slice(0,field.selectionStart)).length : text.selectionStart
    const end = field && field.selectionStart !== field.selectionEnd
      ? text.graphemeSplit(text.text.slice(0,field.selectionEnd)).length : text.selectionEnd
    if (start === end) { field?.focus(); return }
    act(() => text.setSelectionStyles({fill:brand.secondary},start,end))
  }
  return <aside className="studio-properties" aria-label="Propriedades do elemento">
    <h3>{multi ? canvas.getActiveObjects().length + ' elementos selecionados' : text ? 'Editar texto' : image ? 'Editar imagem' : 'Editar elemento'}</h3>
    {text && <>
      <label>Texto do elemento<textarea ref={textField} value={text.text} maxLength={8000} onChange={event => { text.removeStyle('fill'); set({ text: event.target.value }) }} /></label>
      {text.maxHeight !== undefined && text.height * text.scaleY > text.maxHeight && <p className="context-warning">O texto excede o espaço previsto.</p>}
      {text.semantic === 'title' && <details className="studio-advanced"><summary>Destaque do título</summary>
        <p>Selecione um trecho no campo de texto e aplique a cor de acento.</p>
        <div className="studio-actions"><button onClick={highlight}>Destacar seleção</button>
          <button onClick={() => act(() => text.removeStyle('fill'))}>Limpar destaques</button></div>
      </details>}
      {children}
      <label>Fonte<select aria-label="Fonte" value={text.fontFamily} onChange={event => set({ fontFamily: event.target.value })}>
        {!fontChoices(brand).some(font => font.family === text.fontFamily) && <option>{text.fontFamily}</option>}
        {fontChoices(brand).map(font => <option key={font.family} value={font.family}>{font.name}</option>)}</select></label>
      <div className="property-grid">
        {number('Tamanho da fonte','fontSize',text.fontSize,12,300)}
        <label>Peso<select value={String(text.fontWeight)} onChange={event => set({ fontWeight: event.target.value })}><option value="normal">Regular</option><option value="bold">Negrito</option></select></label>
        <label>Alinhamento<select value={text.textAlign} onChange={event => set({ textAlign: event.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
        {color('Cor','fill')}
        {number('Entrelinha','lineHeight',text.lineHeight,.7,3,.05)}
        {number('Espaçamento','charSpacing',text.charSpacing,-100,1000)}
      </div>
    </>}
    {image && <>
      <button onClick={replaceImage}>Substituir imagem</button>
      <div className="studio-actions">
        <button onClick={() => act(() => cropImage(image,1))}>Recortar quadrado</button>
        <button onClick={() => act(() => cropImage(image,4/3))}>Recortar 4:3</button>
        <button onClick={() => act(() => restoreFraming(image))}>Restaurar enquadramento</button>
      </div>
      {(maxX > 0 || maxY > 0) && <div className="crop-pad" aria-hidden="true"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, cropX: image.cropX, cropY: image.cropY }
        }}
        onPointerMove={event => {
          const start = drag.current
          if (!start) return
          image.set({
            cropX: clamp(start.cropX - (event.clientX - start.x) * image.width / event.currentTarget.clientWidth,0,maxX),
            cropY: clamp(start.cropY - (event.clientY - start.y) * image.height / event.currentTarget.clientHeight,0,maxY),
          })
          canvas.requestRenderAll()
        }}
        onLostPointerCapture={() => { if (drag.current) { drag.current = null; changed() } }}>Arraste para reenquadrar</div>}
      <div className="studio-actions" role="group" aria-label="Escala da imagem">
        <button aria-label="Reduzir imagem" disabled={locked} onClick={() => scaleImage(image.scaleX * .9)}>−</button>
        <button aria-label="Ampliar imagem" disabled={locked} onClick={() => scaleImage(image.scaleX * 1.1)}>+</button>
      </div>
    </>}
    {gradientOptions && <div className="property-grid">
      <label>Cor do gradiente<input type="color" value={gradientOptions.color} onChange={event => updateGradient({color:event.target.value})} /></label>
      {numeric('Intensidade (%)',gradientOptions.strength*100,n => updateGradient({strength:n/100}),0,100)}
      {numeric('Início (%)',gradientOptions.start*100,n => updateGradient({start:n/100}),5,Math.round((gradientOptions.finish-.05)*100))}
      {numeric('Fim (%)',gradientOptions.finish*100,n => updateGradient({finish:n/100}),Math.round((gradientOptions.start+.05)*100),100)}
      {numeric('Direção (°)',gradientOptions.angle,n => updateGradient({angle:n}),-180,180)}
    </div>}
    {!multi && !image && !text && !gradient && <div className="property-grid">{color('Cor','fill')}{border}</div>}
    {!multi && <details className="studio-advanced"><summary>Propriedades avançadas</summary><div className="property-grid">
      {number('X','left',object.left)}{number('Y','top',object.top)}
      {number('Rotação','angle',object.angle,-360,360)}{number('Opacidade','opacity',object.opacity,0,1,.05)}
      {image ? <>
        {number('Recorte X','cropX',image.cropX,0,maxX)}{number('Recorte Y','cropY',image.cropY,0,maxY)}
        {numeric('Escala (%)',image.scaleX * 100,n => scaleImage(n / 100),2,1000)}
        {numeric('Largura',image.width * image.scaleX,n => scaleImage(n / image.width),1,5000)}
        {numeric('Altura',image.height * image.scaleY,n => scaleImage(n / image.height),1,5000)}
        {border}
      </> : <>
        {number('Largura','width',object.width,1,5000)}{!text && number('Altura','height',object.height,1,5000)}
        {text && border}
      </>}
    </div></details>}
    {!multi && <details className="studio-advanced"><summary>Organizar camada</summary><div className="studio-actions">
      <button onClick={() => set({ lockMovementX: !locked, lockMovementY: !locked, lockScalingX: !locked, lockScalingY: !locked, lockRotation: !locked })}>{locked ? 'Desbloquear' : 'Bloquear'}</button>
      <button onClick={() => act(() => canvas.bringObjectForward(object))}>Para frente</button>
      <button onClick={() => act(() => canvas.sendObjectBackwards(object))}>Para trás</button>
      <button onClick={() => act(() => align(canvas,'left'))}>Alinhar à esquerda</button>
      <button onClick={() => act(() => align(canvas,'center'))}>Centralizar</button>
      <button onClick={() => act(() => align(canvas,'top'))}>Alinhar ao topo</button>
      <button onClick={() => act(() => { object.set({ visible: !object.visible }); canvas.discardActiveObject() })}>{object.visible ? 'Ocultar' : 'Mostrar'}</button>
    </div></details>}
    {(multi || object instanceof Group) && <button onClick={() => act(() => groupSelection(canvas))}>{multi ? 'Agrupar' : 'Desagrupar'}</button>}
    {multi && <div className="studio-actions">
      <button onClick={() => act(() => align(canvas,'left'))}>Alinhar à esquerda</button>
      <button onClick={() => act(() => align(canvas,'center'))}>Centralizar</button>
      <button onClick={() => act(() => align(canvas,'top'))}>Alinhar ao topo</button>
      <button disabled={canvas.getActiveObjects().length < 3} onClick={() => act(() => align(canvas,'distribute'))}>Distribuir horizontalmente</button>
    </div>}
    <div className="studio-actions">
      {!multi && <button onClick={() => void duplicate(canvas).then(changed)}>Duplicar elemento</button>}
      <button onClick={() => act(() => { canvas.remove(...canvas.getActiveObjects()); canvas.discardActiveObject() })}>Excluir elemento</button>
    </div>
  </aside>
}

import { loadFonts, LocalFontError } from './fonts'
import { useEffect, useRef } from 'react'
import { Canvas, FabricImage } from 'fabric'
import { dimensions, type Brand, type Format, type Scene } from './model'
import './objects'
import { verifySceneLoaded } from './sceneIntegrity'

export function CanvasView({ format, initial, zoom, onFit, guides, brand, onReady, onChange, onSelection, onError }: {
  brand: Brand; format: Format; initial: Scene; zoom: number; onFit: (zoom: number) => void; guides: boolean
  onReady: (canvas: Canvas | null) => void; onChange: (canvas: Canvas) => void; onSelection: () => void; onError: (message: string) => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const [width,height] = dimensions[format]
    const observer = new ResizeObserver(([entry]) => {
      const {width:availableWidth,height:availableHeight} = entry.contentRect
      if (availableWidth && availableHeight) onFit(Math.max(.05, Math.min(1, Math.floor(1000 * Math.min((availableWidth-4)/width,(availableHeight-4)/height))/1000)))
    })
    if (stage.current) observer.observe(stage.current)
    return () => observer.disconnect()
  },[format,onFit])
  const element = useRef<HTMLCanvasElement>(null)
  const instance = useRef<Canvas | null>(null)
  const callbacks = useRef({ onReady, onChange, onSelection, onError })
  useEffect(() => { callbacks.current = { onReady, onChange, onSelection, onError } })
  useEffect(() => {
    const canvas = new Canvas(element.current!, { width: dimensions[format][0], height: dimensions[format][1], preserveObjectStacking: true, backgroundColor: initial.background, uniScaleKey: null })
    const keepImageProportions = (object: unknown) => {
      if (object instanceof FabricImage) object.setControlsVisibility({ ml:false, mr:false, mt:false, mb:false })
    }
    canvas.on('object:added', event => keepImageProportions(event.target))
    instance.current = canvas
    let live = true
    const abort = new AbortController()
    void loadFonts(brand).then(() => canvas.loadFromJSON(initial, undefined, { signal: abort.signal })).then(() => {
      if (!live) return
      verifySceneLoaded(canvas, initial)
      canvas.getObjects().forEach(keepImageProportions)
      canvas.requestRenderAll()
      callbacks.current.onReady(canvas)
      const changed = () => callbacks.current.onChange(canvas)
      canvas.on('object:modified', changed); canvas.on('text:changed', changed)
      canvas.on('selection:created', () => callbacks.current.onSelection()); canvas.on('selection:updated', () => callbacks.current.onSelection()); canvas.on('selection:cleared', () => callbacks.current.onSelection())
    }).catch(error => {
      if (live) callbacks.current.onError(error instanceof LocalFontError ? error.message : 'Não foi possível carregar este slide. Preserve o backup e substitua imagens inválidas.')
    })
    return () => { live = false; abort.abort(); callbacks.current.onReady(null); instance.current = null; void canvas.dispose() }
    // A slide session owns one Fabric instance. Edits are applied through its API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const canvas = instance.current
    if (!canvas) return
    const [width, height] = dimensions[format]
    canvas.setDimensions({ width: Math.round(width * zoom), height: Math.round(height * zoom) }); canvas.setZoom(zoom); canvas.requestRenderAll()
  }, [format, zoom])
  return <div className="canvas-stage" ref={stage}><div className={`canvas-paper ${guides ? 'show-guides' : ''}`} style={{ '--safe-x': `${brand.margin / 1080 * 100}%`, '--safe-y': `${brand.margin / dimensions[format][1] * 100}%` } as React.CSSProperties}><canvas ref={element} aria-label="Canvas editável do Studio" /></div></div>
}

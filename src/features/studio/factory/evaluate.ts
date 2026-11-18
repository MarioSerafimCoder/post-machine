import { contrast, parseColor } from '../../audit/contrast'
import { dimensions, type Brand, type Format, type Scene } from '../model'
import type { PlannedSlide } from './planning'
import type { TextMeasurement } from './typography'

export type Issue = { field?: string; kind: 'text' | 'image' | 'layout' | 'font'; message: string }
export const requiresReview = (issue: Issue) => issue.kind !== 'image' || !issue.message.startsWith('Imagem ainda')
type Bounds = { left: number; top: number; width: number; height: number }
const bounds = (object: Record<string,unknown>): Bounds => ({
  left:Number(object.left ?? 0), top:Number(object.top ?? 0),
  width:Number(object.width ?? Number(object.radius)*2) * Number(object.scaleX ?? 1),
  height:Number(object.height ?? Number(object.radius)*2) * Number(object.scaleY ?? 1),
})
const area = (box: Bounds) => box.width*box.height
const overlap = (a: Bounds,b: Bounds) => Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left)) *
  Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top))

export function evaluateScene(scene: Scene, measurements: TextMeasurement[], slide: PlannedSlide, format: Format, brand: Brand, unavailable: ReadonlySet<string>) {
  const [width,height] = dimensions[format]
  const margin = brand.margin
  const background = parseColor(scene.background)
  const overlay = scene.objects.some(object => ['editorialGradient','editorialCard'].includes(String(object.semantic)))
  const texts = scene.objects.filter(object => typeof object.text === 'string' && object.text.trim() !== '')
  const image = scene.objects.find(object => object.semantic === 'image')
  const layer = image ?? scene.objects.find(object => object.semantic === 'imageFrame')
  const frame = layer && bounds(layer)
  const issues: Issue[] = []
  let penalty = 0
  for (const metric of measurements) {
    if (!metric.fits) {
      issues.push({ kind:'text',field:metric.field, message:'Texto excede o espaço disponível.' })
      penalty += 200 + Math.min(100,metric.lines)
    }
    penalty += (metric.preferred-metric.size)*.34
  }
  let usedArea = 0
  for (const [index,object] of texts.entries()) {
    const box = bounds(object)
    const metric = measurements.find(value => value.field === object.semantic)
    box.width = Number.isFinite(metric?.inkWidth) ? Math.min(box.width,metric!.inkWidth) : box.width
    usedArea += area(box)
    if (box.left < 0 || box.top < 0 || box.left+box.width > width+2 || box.top+box.height > height+2) {
      issues.push({ kind:'layout',field:String(object.semantic),message:'Parte do texto ultrapassa a arte.' })
      penalty += 150
    } else if (box.left < margin-1 || box.top < margin-1 || box.left+box.width > width-margin+2 || box.top+box.height > height-margin+2) {
      issues.push({ kind:'layout',field:String(object.semantic),message:'Texto junto ou além da margem segura.' })
      penalty += 20
    }
    const overlapped = texts.slice(index+1).some(other => overlap(box,bounds(other)) > Math.min(area(box),area(bounds(other)))*.10)
    if (overlapped || (!overlay && frame && overlap(box,frame) > area(box)*.10)) {
      issues.push({ kind:'layout',field:String(object.semantic),message:'Possível sobreposição de texto com outra camada.' })
      penalty += 40
    }
    if (unavailable.has(String(object.fontFamily))) {
      issues.push({kind:'font',field:String(object.semantic),message:'Fonte não confirmada. O navegador pode usar uma substituta.'})
    }
    const panel = scene.objects.find(item => ['collectionPanel','editorialCard'].includes(String(item.semantic)) && overlap(bounds(item),box) >= area(box)-1)
    const foreground = parseColor(object.fill)
    const under = panel ? parseColor(panel.fill) : background
    if (under && foreground && (panel || !image || !frame || !overlap(box,frame)) &&
      contrast(under,foreground) < (Number(object.fontSize) >= 48 ? 3 : 4.5)) {
      issues.push({kind:'layout',field:String(object.semantic),message:'Contraste de texto abaixo do limite no fundo sólido.'})
      penalty += 30
    }
  }
  let retained = 1
  if (image && frame && slide.content.image) {
    retained = Number(image.width)*Number(image.height) / (Number(slide.content.image.width)*Number(slide.content.image.height))
    const scale = Number(image.scaleX)
    if (scale > 1.02) {
      issues.push({ kind:'image',message:'Imagem com resolução insuficiente para o espaço escolhido.' })
      penalty += Math.min(24,(scale-1)*12)
    }
    if (retained < .55) {
      issues.push({ kind:'image',message:'O recorte remove mais de 45% da imagem. Confira o enquadramento.' })
      penalty += (1-retained)*19
    }
  } else issues.push({ kind:'image',message:'Imagem ainda não selecionada. A área é editável.' })
  return { issues, penalty, imageArea:frame ? area(frame)/(width*height) : 0,
    textArea:usedArea/(width*height), retained, titleSize:measurements.find(metric => metric.field === 'title')?.size ?? 0 }
}

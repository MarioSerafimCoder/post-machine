import { Color, Gradient, Rect, Textbox } from 'fabric'
import type { Collection, CollectionSlide } from './collections'
import { imageForFrame } from './collections'
import { dimensions, type Brand, type Format, type Scene } from './model'
import type { Box } from './factory/geometry'
import type { Treatment } from './factory/planning'
import { fitText, type TextMeasurement } from './factory/typography'

export type Premium = 'impact' | 'card' | 'narrative'
type Mode = 'bleed' | 'split' | 'window' | 'quiet'
const modes: Record<Premium, Mode[]> = {
  impact:['bleed','window','split','bleed','quiet','window'],
  card:['window','window','quiet','split','window','quiet'],
  narrative:['bleed','split','quiet','window','bleed','quiet'],
}
const labels = ['Capa','Introdução','Conteúdo','Imagem e texto','Destaque','Encerramento']
export const premiumCollections: Collection[] = [
  { id:'impacto', name:'Impacto Fotográfico', premium:'impact', palette:['#101114','#ffffff','#d60016','#282d34'], style:'Fotografia em tela cheia e títulos de impacto' },
  { id:'cartao', name:'Cartão Editorial', premium:'card', palette:['#161619','#151415','#d60016','#dbd7ce'], style:'Fotografia dominante e cartão de revista' },
  { id:'narrativa', name:'Narrativa Visual', premium:'narrative', palette:['#111817','#f8f6ef','#d60016','#273634'], style:'Texto expressivo, fotografia e ritmo narrativo' },
].map(item => ({ ...item, premium:item.premium as Premium, version:1, art:'photo', palette:item.palette as Collection['palette'],
  formats:['portrait','square','story'], fonts:['Inter','Inter'],
  // The shared factory evaluates six editorial roles for each treatment.
  layouts:modes[item.premium as Premium].map(() => ({ title:[0,0,1,1],body:[0,0,1,1],image:[0,0,1,1],size:96 })),
}))

export function editorialGradient(width: number, height: number, options: { strength: number; start: number; finish?: number; angle: number; color: string }) {
  const { strength,start,finish: requestedFinish=1,angle,color } = options
  const finish = Math.max(start+.05,requestedFinish)
  const span = finish-start
  const radians = angle * Math.PI / 180
  const x = Math.sin(radians) * width
  const y = Math.cos(radians) * height
  const stop = (offset: number, opacity: number) => ({ offset,color:new Color(color).setAlpha(opacity).toRgba() })
  return new Gradient({ type:'linear', gradientUnits:'pixels',
    coords:{ x1:(width-x)/2, x2:(width+x)/2, y1:(height-y)/2, y2:(height+y)/2 },
    colorStops:[stop(0,0),stop(start,strength*.08),stop(start+span*.39,strength*.49),
      stop(start+span*.73,strength*.81),stop(finish,strength),...(finish < 1 ? [stop(1,strength)] : [])],
  })
}

export function composePremium(kind: Premium, index: number, content: CollectionSlide, brand: Brand, format: Format, treatment?: Treatment) {
  const [width,height] = dimensions[format]
  const margin = Math.max(64,brand.margin)
  const mode = modes[kind][index]
  const card = kind === 'card'
  const bleed = mode === 'bleed'
  const dense = content.body.length > 290
  const split = mode === 'split' && !dense && !card
  const leftImage = kind === 'narrative'
  const photoBoost = treatment === 'photo' && !dense ? .06 : 0
  const background = card || bleed ? '#111114' : brand.background
  const dark = /^#[0-4][0-9a-f][0-4][0-9a-f][0-4][0-9a-f]$/i.test(background)
  const ink = card ? '#151415' : bleed ? '#ffffff' : dark ? '#f8f6ef' : '#151415'
  const accent = brand.secondary
  const cardInset = card ? 26 : kind === 'narrative' && bleed ? 36 : 0
  const textX = margin + cardInset + (split && leftImage ? width*.33 : 0)
  const textW = width-2*margin-2*cardInset-(split ? width*.33 : 0)
  const floor = height-margin
  const top = mode === 'window' || (mode === 'split' && !split)
    ? height*(dense ? .35 : index === 1 ? .46 + photoBoost : .51 + photoBoost)
    : bleed ? height*(dense ? .34 : .48) : height*(mode === 'quiet' && !dense ? index === 5 ? .32 : .28 : .15)
  const heights = floor-top
  const objects: Scene['objects'] = []
  const measurements: TextMeasurement[] = []
  const issues: string[] = []
  const add = (item: { toObject: () => unknown }) => objects.push(item.toObject() as Scene['objects'][number])
  const rect = (bounds: Box, fill: string | ReturnType<typeof editorialGradient>, semantic: string, radius = 0) => {
    const [left,top,w,h] = bounds
    add(new Rect({ left,top,width:w,height:h,rx:radius,ry:radius,fill,semantic,strokeWidth:0,
      originX:'left',originY:'top',evented:semantic !== 'editorialGradient' }))
  }
  const text = (semantic: string, value: string, fontSize: number, min: number, limit: number, heading = false) => {
    if (!value) return undefined
    const item = new Textbox(value,{ left:textX,top:0,width:textW,fontSize,fill:ink,semantic,maxHeight:limit,
      fontFamily:heading ? brand.headingFont : brand.bodyFont,fontWeight:heading ? 'bold' : 'normal',
      lineHeight:heading ? 1.04 : 1.23,originX:'left',originY:'top' })
    const metric = fitText(item,textW,limit,fontSize,min)
    measurements.push(metric)
    if (!metric.fits) issues.push(semantic)
    if (semantic === 'title') {
      if (content.headlines) item.headlines = content.headlines
      const emphasis = content.emphasis?.trim()
      const offset = emphasis ? value.indexOf(emphasis) : -1
      if (emphasis && offset >= 0) {
        const from = item.graphemeSplit(value.slice(0,offset)).length
        item.setSelectionStyles({fill:accent},from,from+item.graphemeSplit(emphasis).length)
      }
    }
    return item
  }
  const category = text('subtitle',content.subtitle || labels[index],25,24,65)
  const hasCTA = !!content.cta
  const bodyLimit = content.body ? Math.max(44,heights*(dense ? .46 : .23)) : 0
  const titleLimit = Math.max(65,heights-bodyLimit-150-(hasCTA ? 50 : 0))
  const size = Math.min(106,[kind === 'narrative' ? 89 : 100,77,68,72,92,82][index] + (treatment === 'expressive' ? 8 : treatment === 'photo' ? -6 : 0))
  const heading = text('title',content.title,size,index === 0 ? 68 : 56,titleLimit,true)
  const body = text('body',content.body,36,30,bodyLimit)
  const cta = text('cta',content.cta ?? '',34,28,54,true)
  const signature = text('brand',[brand.name,brand.handle].filter(Boolean).join(' · '),22,20,30)
  const groupHeight = (category?.height ?? 0) + (heading?.height ?? 0) + (body?.height ?? 0) + (cta?.height ?? 0) +
    (category && heading ? 26 : 0) + (heading && body ? 30 : 0) + (cta ? 22 : 0)
  const footerHeight = card || signature ? 52 : 0
  const y = bleed || (card && mode !== 'quiet') ? Math.max(top, floor-groupHeight-footerHeight) : top
  let frame: Box | undefined
  if (bleed) frame = [0,0,width,height]
  else if (split) frame = [leftImage ? margin : width-margin-width*.29,margin,width*.29,height-margin*2]
  else if (mode !== 'quiet') frame = card ? index === 3 ? [margin-18,margin,width-2*margin+36,Math.min(height*.58,y)] : [0,0,width,Math.min(height*.72,y+38)] : [0,0,width,Math.max(120,top-28)]
  else if (!card || content.image) frame = [width-margin-130-(brand.logo ? 56 : 0),margin,130,Math.min(88,height*.075)]
  if (frame) {
    if (content.image) {
      const portraitInWideFrame = Number(content.image.height) > Number(content.image.width) && frame[2] > frame[3]*1.2
      objects.push(imageForFrame(content.image,frame,content.framing,portraitInWideFrame ? .23 : .5))
    }
    else rect(frame,card ? '#39383e' : dark ? '#2a3336' : '#dedbd4','imageFrame')
  }
  if (bleed) {
    const x = editorialGradient(width,height,{ strength:kind === 'narrative' ? .92 : .95,start:dense ? .29 : .38,angle:0,color:'#000000' })
    rect([0,0,width,height],x,'editorialGradient')
  }
  if (card) rect([margin-18,y-27,width-2*margin+36,Math.max(100,floor-y+48)],'#fcfaf6','editorialCard',24)
  let cursor = y
  if (category) {
    const badge = kind === 'narrative' && !card && category.height < 42
    if (badge) {
      const badgeWidth = Math.min(textW,category.getLineWidth(0) + 34)
      rect([textX,cursor-7,badgeWidth,43],dark ? '#242b29' : '#eae8e2','editorialBadge',6)
      category.set({ left:textX+14,width:textW-14 })
    } else {
      rect([textX,cursor+11,28,4],accent,'collectionAccent')
      category.set({ left:textX+42,width:textW-42 })
    }
    category.set({top:cursor})
    add(category)
    cursor += category.height + 26
  }
  if (heading) { heading.set({top:cursor}); add(heading); cursor += heading.height + 30 }
  if (body) { body.set({top:cursor}); add(body); cursor += body.height + 22 }
  if (cta) {
    cta.set({top:cursor}); add(cta)
    if (cursor+cta.height+14 < floor-43) rect([textX,cursor+cta.height+11,48,3],accent,'collectionAccent')
  }
  if (card) rect([textX,floor-37,textW,1],'#b7b1a9','editorialRule')
  if (signature) { signature.set({top:floor-28}); add(signature) }
  if (card && !signature && category) {
    // The editorial marker in the footer identifies the layout when no brand is supplied.
    rect([textX,floor-19,32,3],accent,'collectionAccent')
  }
  if (brand.logo) objects.push({ type:'Image',src:brand.logo,left:width-margin-48,top:margin,width:180,height:180,
    scaleX:48/180,scaleY:48/180,originX:'left',originY:'top',semantic:'logo' })
  return { scene:{objects,background}, issues, measurements }
}

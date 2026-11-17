import { Circle, Rect, Textbox, type FabricImage } from 'fabric'
import { dimensions, newProject, type Brand, type Format, type Project, type Scene } from './model'
import { cropImage } from './images'
import { sceneForCollection } from './collectionPosition'
import { treatComposition, type Box, type Composition } from './factory/geometry'
import { fitText, type TextMeasurement } from './factory/typography'
import type { Treatment } from './factory/planning'
import { composePremium, premiumCollections, type Premium } from './premium'
import './objects'

export const compositionNames = ['Capa', 'Introdução', 'Conteúdo', 'Imagem + texto', 'Destaque', 'Encerramento'] as const
type Art = 'line' | 'photo' | 'block' | 'grid' | 'orbit' | 'column' | 'cards' | 'type'
export type Collection = {
  version: 1; id: string; name: string; style: string; formats: readonly Format[]; art: Art
  palette: [paper: string, ink: string, accent: string, panel: string]
  fonts: [heading: string, body: string]; layouts: Composition[]; premium?: Premium
}
const layout = (title: Box, body: Box, image: Box, size: number): Composition => ({ title, body, image, size })
const formats = ['portrait', 'square', 'story'] as const
function collection(id: string, name: string, style: string, art: Art, palette: Collection['palette'], heading: string, layouts: Composition[]): Collection {
  return { version: 1, id, name, style, art, palette, fonts: [heading, 'Inter'], formats, layouts }
}

export const collections = [
  collection('minimal', 'Editorial Minimalista', 'Serifa expressiva e espaço negativo', 'line', ['#f4efe5','#201c18','#ae432b','#e6d6bd'], 'Georgia', [
    layout([0,.12,.76,.31],[0,.49,.58,.23],[.64,.5,.36,.32],114),
    layout([.12,.11,.88,.24],[.12,.44,.78,.23],[0,.72,.45,.14],82),
    layout([0,.12,.65,.24],[0,.44,.62,.38],[.7,.43,.3,.26],80),
    layout([0,.12,.92,.22],[.58,.43,.42,.37],[0,.4,.52,.45],76),
    layout([.17,.22,.78,.32],[.17,.6,.62,.22],[0,.12,.13,.54],102),
    layout([0,.17,.76,.31],[0,.53,.63,.22],[.71,.56,.29,.24],100),
  ]),
  collection('photo', 'Editorial Fotográfico', 'Imagem dominante e manchete editorial', 'photo', ['#242326','#ffffff','#ffd55a','#5a5362'], 'Inter', [
    layout([.06,.56,.89,.21],[.06,.79,.9,.09],[0,.08,1,.48],91),
    layout([.02,.1,.74,.22],[.02,.33,.73,.18],[0,.53,1,.32],80),
    layout([0,.11,.57,.24],[0,.39,.54,.43],[.59,.12,.41,.71],76),
    layout([.05,.57,.9,.19],[.05,.78,.9,.1],[0,.08,1,.47],72),
    layout([.08,.24,.84,.28],[.08,.71,.84,.15],[0,.54,1,.13],92),
    layout([.02,.08,.84,.24],[.02,.35,.65,.19],[0,.57,1,.27],87),
  ]),
  collection('bold', 'Bold Criativo', 'Escala, assimetria e blocos geométricos', 'block', ['#f56236','#171319','#171319','#ffc6a4'], 'Arial Black', [
    layout([0,.13,1,.37],[.46,.57,.54,.27],[0,.58,.39,.25],112),
    layout([.41,.13,.59,.32],[.41,.48,.59,.35],[0,.19,.34,.54],85),
    layout([0,.12,.88,.27],[.12,.43,.54,.39],[.71,.48,.29,.33],93),
    layout([0,.08,.75,.27],[.61,.38,.39,.43],[0,.37,.54,.46],85),
    layout([0,.16,1,.39],[0,.59,.59,.25],[.66,.63,.34,.2],115),
    layout([.22,.13,.78,.35],[.22,.55,.78,.22],[0,.21,.16,.52],100),
  ]),
  collection('swiss', 'Swiss Grid', 'Grade racional e hierarquia tipográfica', 'grid', ['#fffdfa','#161616','#bb1520','#e9e6e2'], 'Inter', [
    layout([.34,.12,.66,.33],[0,.52,.31,.29],[.34,.51,.66,.31],86),
    layout([0,.11,.61,.27],[.35,.42,.65,.35],[0,.43,.31,.34],82),
    layout([.34,.1,.66,.28],[.34,.43,.66,.39],[0,.13,.31,.69],78),
    layout([.51,.1,.49,.3],[.51,.45,.49,.36],[0,.12,.47,.7],72),
    layout([.17,.14,.83,.33],[.17,.56,.53,.26],[.74,.56,.26,.26],96),
    layout([0,.13,.65,.36],[.34,.56,.66,.25],[0,.55,.29,.24],83),
  ]),
  collection('dark', 'Dark Editorial', 'Fundo escuro, serifa e acentos metálicos', 'orbit', ['#191922','#f4ece0','#e3ba77','#403946'], 'Georgia', [
    layout([.06,.27,.88,.32],[.18,.63,.64,.19],[.32,.09,.36,.16],110),
    layout([0,.15,.72,.26],[0,.46,.59,.3],[.65,.42,.35,.35],84),
    layout([.18,.11,.82,.22],[.17,.4,.6,.39],[.8,.42,.2,.32],80),
    layout([.06,.53,.88,.18],[.12,.75,.76,.13],[.06,.11,.88,.38],74),
    layout([.06,.21,.88,.36],[.18,.65,.64,.19],[.36,.1,.28,.09],105),
    layout([.11,.23,.78,.31],[.11,.59,.78,.24],[.35,.1,.3,.1],96),
  ]),
  collection('magazine', 'Magazine', 'Colunas, contraste e cadernos de revista', 'column', ['#fbf1dc','#23201e','#a8474c','#dcc9b2'], 'Georgia', [
    layout([0,.1,1,.22],[.56,.44,.44,.36],[0,.38,.5,.45],92),
    layout([0,.13,.57,.31],[0,.48,.53,.34],[.58,.12,.42,.69],92),
    layout([0,.11,1,.23],[0,.39,.74,.42],[.79,.42,.21,.38],81),
    layout([.52,.12,.48,.29],[.52,.45,.48,.37],[0,.11,.47,.72],78),
    layout([.12,.21,.88,.31],[.12,.59,.62,.2],[.77,.58,.23,.22],102),
    layout([0,.16,.92,.31],[0,.56,.51,.23],[.56,.55,.44,.27],92),
  ]),
  collection('modular', 'Visual Modular', 'Cards e blocos para informação visual', 'cards', ['#e8ecf8','#1b2142','#354ba3','#c8d1f2'], 'Inter', [
    layout([.04,.15,.92,.26],[.07,.51,.49,.3],[.63,.49,.33,.32],99),
    layout([.05,.14,.58,.25],[.05,.46,.59,.35],[.71,.17,.24,.61],78),
    layout([.06,.12,.88,.22],[.05,.43,.87,.24],[.05,.71,.9,.13],78),
    layout([.55,.12,.41,.24],[.55,.4,.41,.41],[.04,.14,.45,.67],74),
    layout([.09,.18,.82,.29],[.48,.54,.45,.27],[.06,.53,.33,.28],93),
    layout([.09,.15,.82,.3],[.09,.56,.82,.17],[.09,.76,.82,.09],86),
  ]),
  collection('manifesto', 'Manifesto Tipográfico', 'Frases em grande escala e ritmo visual', 'type', ['#fff2dc','#421d60','#8a368c','#eed5ee'], 'Arial Black', [
    layout([0,.12,1,.44],[0,.64,.69,.21],[.74,.63,.26,.22],130),
    layout([.26,.09,.74,.36],[.26,.49,.74,.33],[0,.2,.19,.53],98),
    layout([0,.09,.89,.31],[.25,.49,.75,.34],[0,.5,.2,.3],103),
    layout([0,.09,1,.29],[.61,.46,.39,.38],[0,.43,.56,.41],95),
    layout([0,.15,1,.42],[0,.66,.71,.21],[.78,.63,.22,.22],128),
    layout([.12,.13,.88,.4],[.12,.6,.76,.2],[0,.2,.07,.6],108),
  ]),
  ...premiumCollections,
]

export type CollectionSlide = {
  title: string; subtitle?: string; emphasis?: string; body: string; cta?: string; imageBrief?: string
  role?: 'cover' | 'content' | 'cta'; composition?: number; image?: Record<string, unknown>
  intent?: 'highlight' | 'comparison'; framing?: 'cover' | 'contain'
  headlines?: import('../headlines/contract').HeadlineSession
}
const samples: CollectionSlide[] = [
  { title: 'Ideias em forma', emphasis:'em forma', subtitle: 'Caderno de criação', body: 'Um estudo sobre escolhas visuais e o que elas comunicam.' },
  { title: 'Comece pela pergunta', body: 'Que impressão você quer deixar? Observe o contexto antes de escolher a linguagem.' },
  { title: 'Organize o essencial', body: 'Dê prioridade ao que precisa ser entendido primeiro. Use escala e espaço para guiar a leitura.' },
  { title: 'A imagem também fala', body: 'Enquadramento, ritmo e contraste mudam a forma como lemos uma cena.' },
  { title: 'Cada detalhe comunica.', body: 'Uma ideia para guardar e revisitar na próxima composição.' },
  { title: 'Leve a ideia adiante', body: 'Escolha um princípio e aplique no seu próximo projeto.', cta: 'Salve para consultar depois' },
]
export const demoSlides = samples
const hasBrand = (brand: Brand) => Boolean(brand.name || brand.handle || brand.logo || brand.fonts.length ||
  brand.margin !== 80 || brand.primary !== '#111111' || brand.secondary !== '#d60016' ||
  brand.background !== '#ffffff' || brand.headingFont !== 'Inter' || brand.bodyFont !== 'Inter')
export function collectionBrand(style: Collection, brand: Brand): Brand {
  if (hasBrand(brand)) return brand
  return { ...brand, background: style.palette[0], primary: style.palette[1], secondary: style.palette[2],
    headingFont: style.fonts[0], bodyFont: style.fonts[1], ...(style.premium ? {margin:64} : {}) }
}

export function imageForFrame<T extends Record<string, unknown>>(source: T, frame: Box, framing: 'cover' | 'contain' = 'cover', focusY = .5) {
  const [left, top, width, height] = frame
  const ow = Number(source.width), oh = Number(source.height)
  if (framing === 'contain') {
    const scale = Math.min(width / ow,height / oh)
    return { ...source, left:left+(width-ow*scale)/2, top:top+(height-oh*scale)/2,
      width:ow,height:oh,scaleX:scale,scaleY:scale,cropX:0,cropY:0,semantic:'image' }
  }
  const scale = Math.max(width / ow, height / oh)
  const cropWidth = width / scale, cropHeight = height / scale
  return { ...source, left, top, width: cropWidth, height: cropHeight, scaleX: scale, scaleY: scale,
    cropX: (ow - cropWidth) / 2, cropY: (oh - cropHeight) * focusY, semantic: 'image' }
}

export function composeCollection(style: Collection, index: number, content: CollectionSlide, brand: Brand, format: Format, treatment?: Treatment) {
  if (style.premium) return composePremium(style.premium,index,content,brand,format,treatment)
  const [width, height] = dimensions[format]
  const m = brand.margin
  const w = width - m * 2, h = height - m * 2
  const ratio = content.image ? Number(content.image.width)/Number(content.image.height) : 0
  const { title, body, image, size } = treatment ? treatComposition(style.layouts[index],treatment,index,ratio,content.body.length > 280) : style.layouts[index]
  const objects: Scene['objects'] = []
  const issues: string[] = []
  const measurements: TextMeasurement[] = []
  const box = ([x, y, bw, bh]: Box): Box => [m + x*w, m + y*h, bw*w, bh*h]
  const rect = ([left, top, rw, rh]: Box, fill: string, semantic: string) => {
    objects.push(new Rect({ left, top, width: rw, height: rh, originX: 'left', originY: 'top',
      strokeWidth: 0, fill, semantic }).toObject() as unknown as Scene['objects'][number])
  }
  const text = (semantic: string, value: string, bounds: Box, fontSize: number, min: number, heading = false) => {
    if (!value) return
    const [left, top, tw, maxHeight] = box(bounds)
    const item = new Textbox(value, { left, top, width: tw, fontSize, fontFamily: heading ? brand.headingFont : brand.bodyFont,
      fontWeight: heading ? 'bold' : 'normal', fill: brand.primary, semantic, maxHeight, lineHeight: 1.1,
      originX: 'left', originY: 'top' })
    if (treatment) {
      const metrics = fitText(item,tw,maxHeight,fontSize,min)
      measurements.push(metrics)
      if (!metrics.fits) issues.push(semantic)
    } else {
      while ((item.height > maxHeight || item.width > tw + 1) && item.fontSize > min)
        item.set({ fontSize: Math.max(min, item.fontSize - 2), width: tw })
      if (item.height > maxHeight + 1 || item.width > tw + 1) issues.push(semantic)
    }
    if (semantic === 'title' && content.headlines) item.headlines = content.headlines
    objects.push(item.toObject() as unknown as Scene['objects'][number])
  }

  if (style.art === 'block') rect(box([0,.06,1,.026]),brand.secondary,'collectionAccent')
  if (style.art === 'grid') for (const y of [.07,.39,.88]) rect(box([0,y,1,.003]),brand.secondary,'collectionAccent')
  if (style.art === 'line' || style.art === 'column') rect(box([0,.06,1,.003]),brand.secondary,'collectionAccent')
  if (style.art === 'column') rect(box([.535,.38,.003,.44]),brand.secondary,'collectionAccent')
  if (style.art === 'cards') {
    rect(box([0,.06,1,.022]),brand.secondary,'collectionAccent')
    const [x,y,bw,bh] = body
    rect(box([x-.018,y-.016,bw+.036,bh+.032]),style.palette[3],'collectionPanel')
  }
  if (style.art === 'type') rect(box([0,.065,.66,.012]),brand.secondary,'collectionAccent')
  if (style.art === 'orbit') {
    objects.push(new Circle({ left: width*.46, top: m, radius: width*.04, fill: 'transparent', stroke: brand.secondary,
      strokeWidth: 4, semantic: 'collectionAccent' }).toObject() as unknown as Scene['objects'][number])
  }
  if (style.art === 'photo') rect(box([0,.061,1,.008]),brand.secondary,'collectionAccent')
  if (treatment === 'expressive') rect(box([0,.065,.27,.018]),brand.secondary,'collectionAccent')
  if (treatment === 'photo' && !content.image) rect(box([0,.088,1,.004]),brand.secondary,'collectionAccent')
  const imageBounds = box(image)
  if (content.image) objects.push(imageForFrame(content.image,imageBounds,content.framing))
  else {
    rect(imageBounds, brand.background !== style.palette[0] ? brand.secondary : style.palette[3], 'imageFrame')
    const [left,top,iw,ih] = imageBounds
    if (Math.min(iw,ih) >= 100) {
      const radius = Math.min(iw,ih) * .18
      objects.push(new Circle({ left:left+iw*.51, top:top+ih*.14, radius, fill:brand.primary, opacity:.16,
        semantic:'imageDecoration', strokeWidth:0 }).toObject() as unknown as Scene['objects'][number])
      rect([left+iw*.1,top+ih*.7,iw*.8,ih*.032],brand.primary,'imageDecoration')
      rect([left+iw*.1,top+ih*.8,iw*.5,ih*.016],brand.primary,'imageDecoration')
    }
  }
  text('title',content.title,title,size,42,true)
  text('subtitle',content.subtitle ?? '',[0,.01,.76,.05],27,21)
  text('body',content.body,body,38,26)
  text('cta',content.cta ?? '',[0,.885,.94,.058],32,24,true)
  text('brand',[brand.name,brand.handle].filter(Boolean).join(' / '),[0,.955,.8,.043],23,18)
  if (brand.logo) objects.push(logoObject(brand.logo,width,m))
  return { scene: { objects, background: brand.background }, issues, measurements }
}

function logoObject(src: string, width: number, margin: number) {
  return { type:'Image',src,left:width-margin-55,top:margin-12,width:180,height:180,
    scaleX:55/180,scaleY:55/180,originX:'left',originY:'top',semantic:'logo' }
}

export function buildCollectionProject(style: Collection, format: Format, brand: Brand, slides: CollectionSlide[], name: string): Project {
  const project = newProject(format)
  const actualBrand = collectionBrand(style,brand)
  return { ...project, brand, name: name.trim().slice(0,100) || style.name, slides: slides.map((slide,index) => {
    const role = slide.role ?? (slides.length === 1 ? 'content' : index === 0 ? 'cover' : index === slides.length - 1 ? 'cta' : 'content')
    const composition = sceneForCollection(slide,index,slides.length)
    return { id: crypto.randomUUID(), role, layout: `collection-v1:${style.id}:${composition}`, imageBrief: slide.imageBrief ?? '',
      scene: composeCollection(style,composition,slide,actualBrand,format).scene }
  }) }
}

export function applyCollectionBrand(scene: Scene, brand: Brand, format: Format, premium = false): Scene {
  let identity = false
  const apply = (object: Scene['objects'][number]): Scene['objects'][number] => {
    if (Array.isArray(object.objects)) return { ...object, objects: object.objects.flatMap(child =>
      child.semantic === 'logo' ? [] : [apply(child)]) }
    if (object.semantic === 'collectionAccent') {
      return { ...object, ...(object.fill === 'transparent' ? { stroke:brand.secondary } : { fill:brand.secondary }) }
    }
    if (object.semantic === 'imageFrame' || object.semantic === 'imageDecoration')
      return { ...object, fill:object.semantic === 'imageFrame' ? brand.secondary : brand.primary }
    if (object.semantic === 'collectionPanel') return { ...object, fill:brand.background }
    if (['title','subtitle','body','cta','brand'].includes(String(object.semantic))) {
      const heading = object.semantic === 'title' || object.semantic === 'cta'
      if (object.semantic === 'brand') identity = true
      return { ...object, fill:premium ? object.fill : brand.primary, fontFamily:heading ? brand.headingFont : brand.bodyFont,
        ...(object.semantic === 'brand' ? { text:[brand.name,brand.handle].filter(Boolean).join(' / ') } : {}) }
    }
    return object
  }
  const objects = scene.objects.filter(object => object.semantic !== 'logo').map(apply)
  const [width,height] = dimensions[format]
  const label = [brand.name,brand.handle].filter(Boolean).join(' / ')
  if (label && !identity) objects.push(new Textbox(label, { semantic:'brand', left:brand.margin,
    top:height-brand.margin-36, width:width-brand.margin*2, fontFamily:brand.bodyFont, fontSize:23, fill:premium ? (scene.objects.find(object => object.semantic === 'title')?.fill as string ?? '#ffffff') : brand.primary,
    originX:'left', originY:'top' }).toObject() as unknown as Scene['objects'][number])
  if (brand.logo) objects.push(logoObject(brand.logo,width,brand.margin))
  return { ...scene, background:premium ? scene.background : brand.background, objects }
}

export function prepareCollectionImage(image: FabricImage) {
  image.set({ originX: 'left', originY: 'top', semantic: 'image' })
  cropImage(image, image.width / image.height)
  return image.toObject() as unknown as Record<string, unknown>
}

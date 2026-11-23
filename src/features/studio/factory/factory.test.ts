import { Textbox } from 'fabric'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { collections, imageForFrame } from '../collections'
import { defaultBrand } from '../model'
import { validateProject } from '../validation'
import { compositionPreference, divideBody, planSlides } from './planning'
import { fitText } from './typography'
import { candidateLimitPerSlide, fabricate, recompose } from './fabricate'

const image = (id: string, width: number, height: number) => ({
  type:'Image',src:'data:image/png;base64,'+id,width,height,
  imageCredit:{schemaVersion:1,provider:'openverse',sourceId:'ee293bf3-d38a-4162-aca8-771708adc0b8',
    retrievedAt:'2026-11-16T16:00:00.000Z',title:'Arquivo de teste'},
})
const assets = [
  {id:'a',name:'A',object:image('AAAA',1600,900)},
  {id:'b',name:'B',object:image('BBBB',900,1600)},
  {id:'c',name:'C',object:image('CCCC',1000,1000)},
]
const copy = { title:'O valor da forma',body:'Um argumento com começo.\n\nE outro parágrafo, sem alterar a redação.' }
const fontDescriptor = Object.getOwnPropertyDescriptor(document,'fonts')
beforeEach(() => {
  Object.defineProperty(document,'fonts',{ configurable:true,value:{load:async () => [],check:(font: string) => !font.includes('Fonte Inexistente')} })
})
afterEach(() => {
  if (fontDescriptor) Object.defineProperty(document,'fonts',fontDescriptor)
  else Reflect.deleteProperty(document,'fonts')
})

describe('planejamento de conteúdo e imagens', () => {
  it('reserva vínculos manuais e sugere por termos verificáveis antes da distribuição', () => {
    const [fallback, suggested, manual, empty] = planSlides([
      copy, { ...copy, imageBrief: 'Pátio interno com sombra' }, { ...copy, imageId: 'c' }, { ...copy, imageId: null },
    ], [assets[0], { ...assets[1], name: 'patio-interno.png' }, assets[2]])
    expect(fallback.picture).toMatchObject({ origin: 'automatic', id: 'a' })
    expect(suggested.picture).toMatchObject({ origin: 'suggested', id: 'b', reason: expect.stringContaining('patio') })
    expect(manual.picture).toMatchObject({ origin: 'manual', id: 'c' })
    expect(empty.picture).toBeUndefined()
  })
  it('reserva associações explícitas e arquivos vinculados antes de distribuir sem repetição', () => {
    const inputs = [copy,{...copy,imageId:'a'},{ ...copy,imageId:null },{ ...copy,image:assets[2].object }]
    const plan = planSlides(inputs,assets)
    expect(plan.map(slide=>slide.picture?.origin)).toEqual(['automatic','manual',undefined,'linked'])
    expect(plan.map(slide=>slide.orientation)).toEqual(['vertical','horizontal','none','square'])
    expect(plan[0].picture?.name).toBe('B')
    expect(plan[1].content.image?.imageCredit).toEqual(assets[0].object.imageCredit)
  })
  it('valoriza destaque e comparação apenas quando explícitos e divide sem perder caracteres', () => {
    const [highlight,compare] = planSlides([
      {...copy,role:'content',intent:'highlight'},{...copy,role:'content',intent:'comparison'},
    ],[])
    expect(compositionPreference(highlight,0,4)).toBeGreaterThan(compositionPreference(highlight,0,2))
    expect(compositionPreference(compare,1,2)).toBeGreaterThan(compositionPreference(compare,1,4))
    expect(divideBody(copy.body)?.join('')).toBe(copy.body)
    expect(divideBody('Um único parágrafo.')).toBeUndefined()
  })
  it('calcula enquadramento sem distorcer e conserva créditos', () => {
    const box: [number,number,number,number] = [80,100,380,620]
    const fill = imageForFrame(assets[0].object,box)
    const entire = imageForFrame(assets[0].object,box,'contain')
    expect(fill.scaleX).toBe(fill.scaleY)
    expect(fill.width*fill.scaleX).toBeCloseTo(box[2])
    expect(fill.cropX).toBeGreaterThan(0)
    expect(entire.cropX).toBe(0)
    expect(entire.width).toBe(assets[0].object.width)
    expect(entire.imageCredit).toEqual(assets[0].object.imageCredit)
  })
})

describe('tipografia e propostas', () => {
  it('mede quebras e altura sem reescrever o texto ou ultrapassar o mínimo', () => {
    const original = 'Um título curto'
    const item = new Textbox(original,{ width:310,fontSize:62,lineHeight:1.1 })
    const short = fitText(item,310,155,62,42)
    expect(short.fits).toBe(true)
    expect(short.lines).toBeGreaterThan(0)
    const body = copy.body.repeat(77)
    const long = new Textbox(body,{ width:180,fontSize:38,lineHeight:1.1 })
    const result = fitText(long,180,120,38,26)
    expect(result).toMatchObject({ size:26,fits:false })
    expect(long.text).toBe(body)
    expect(result.lines).toBeGreaterThan(5)
  })
  it('produz três projetos distintos, com a coleção e todos os campos intactos', async () => {
    const style = collections[3]
    const full = { ...copy, subtitle:'Guia editorial',cta:'Salve para consultar',imageId:'a' }
    const input = {style,brand:defaultBrand,format:'square' as const,slides:[full,copy],assets}
    const result = await fabricate(input,new AbortController().signal,vi.fn())
    expect(result.candidates).toBe(2*candidateLimitPerSlide)
    expect(result.proposals.map(proposal=>proposal.treatment)).toEqual(['balanced','photo','expressive'])
    const rendered = result.proposals.map(proposal => {
      expect(validateProject(proposal.project).slides).toHaveLength(2)
      const slide = proposal.project.slides[0]
      expect(slide.layout).toContain(style.id)
      const text = (field: string) => slide.scene.objects.find(object => object.semantic === field)?.text
      expect([text('title'),text('subtitle'),text('body'),text('cta')]).toEqual([full.title,full.subtitle,full.body,full.cta])
      const photo = slide.scene.objects.find(object=>object.semantic==='image')!
      expect(photo.imageCredit).toEqual(assets[0].object.imageCredit)
      return JSON.stringify(slide.scene.objects)
    })
    expect(new Set(rendered).size).toBe(3)
    const version = result.proposals[1]
    const replacement = recompose(input,result.slides[0],version,0,4)
    expect(replacement.details[0].composition).toBe(4)
    expect(replacement.project.slides[1]).toBe(version.project.slides[1])
  })
  it('avisa fonte ausente, mantém placeholder e encerra uma fabricação cancelada', async () => {
    const controller = new AbortController()
    const input = {style:collections[0],brand:{...defaultBrand,headingFont:'Fonte Inexistente'},
      format:'portrait' as const,slides:[copy,copy],assets:[]}
    const result = await fabricate(input,controller.signal,vi.fn())
    expect(result.proposals[0].details[0].issues.map(issue=>issue.kind)).toEqual(expect.arrayContaining(['font','image']))
    expect(result.proposals[1].project.slides[0].scene.objects.some(object=>object.semantic==='imageFrame')).toBe(true)
    await expect(fabricate(input,controller.signal,()=>controller.abort())).rejects.toMatchObject({name:'AbortError'})
  })
})

it.each([1,6,10,20])('mantém campos completos e orçamento de seleção em %i slides', async count => {
  const style = collections.find(item => item.premium === 'narrative')!
  const slides = Array.from({length:count},(_,index) => ({
    ...copy, title:copy.title+' '+index, body:index%4===0 ? copy.body.repeat(8) : copy.body,
    imageId:index===0 ? 'b' : undefined,
  }))
  const result = await fabricate({style,brand:defaultBrand,format:'portrait',slides,assets},new AbortController().signal,vi.fn())
  expect(result.candidates).toBe(count*candidateLimitPerSlide)
  expect(result.proposals).toHaveLength(3)
  expect(result.slides[0].picture?.name).toBe('B')
  for (const proposal of result.proposals) expect(proposal.project.slides.map(slide => slide.scene.objects.find(object=>object.semantic==='body')?.text)).toEqual(slides.map(slide=>slide.body))
})

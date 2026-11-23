import { describe, expect, it, vi } from 'vitest'
import { FabricImage, Group, Rect, StaticCanvas, Textbox } from 'fabric'
import { defaultBrand, newProject } from '../studio/model'
import '../studio/objects'
import { contrast, parseColor } from './contrast'
import { inspectCanvas, locate } from './rules'
import { prepareSafeMove } from './fix'

function canvas(...objects: (Rect|Textbox|Group|FabricImage)[]) {
  const value=new StaticCanvas(undefined,{width:1080,height:1350,backgroundColor:'#ffffff'})
  value.add(...objects)
  return value
}
const issues=(value:StaticCanvas)=>inspectCanvas(value,'slide',1,defaultBrand,'blank','content')
describe('auditoria técnica',()=>{
  it('mede contraste WCAG para cores sólidas',()=>{
    expect(contrast(parseColor('#000000')!,parseColor('#ffffff')!)).toBeCloseTo(21)
    expect(contrast(parseColor('#ffffff')!,parseColor('#ffffff')!)).toBe(1)
  })
  it('mantém texto dentro da margem sem aviso geométrico',()=>{
    const value=canvas(new Textbox('Texto',{left:100,top:100,width:300,fontSize:40,fill:'#000000',originX:'left',originY:'top'}))
    expect(issues(value).some(f=>f.ruleId==='SAFE_MARGIN')).toBe(false)
  })
  it('encontra texto fora da margem',()=>{
    const value=canvas(new Textbox('Texto',{left:20,top:20,width:300,fontSize:40,fill:'#000000'}))
    expect(issues(value).some(f=>f.ruleId==='SAFE_MARGIN')).toBe(true)
  })
  it('encontra objeto parcialmente fora do canvas mesmo rotacionado',()=>{
    const value=canvas(new Rect({left:1020,top:150,width:200,height:100,angle:30}))
    expect(issues(value).some(f=>f.ruleId==='OUTSIDE_CANVAS')).toBe(true)
  })
  it('identifica caminhos de objetos agrupados',()=>{
    const value=canvas(new Group([new Rect({left:0,top:0,width:100,height:100})],{left:50,top:50}))
    expect(locate(value)[0].path).toBe('0.0')
  })
  it('mede o objeto agrupado com a transformação do grupo',()=>{
    const value=canvas(new Group([new Rect({left:0,top:0,width:100,height:100})],{left:1100,top:50,originX:'left',originY:'top'}))
    expect(issues(value).some(f=>f.ruleId==='OUTSIDE_CANVAS'&&f.objectId==='0.0')).toBe(true)
  })
  it('detecta texto que excede a altura definida',()=>{
    const text=new Textbox('Linha um\nLinha dois\nLinha três',{left:100,top:100,width:200,fontSize:50});text.maxHeight=30
    expect(issues(canvas(text)).some(f=>f.ruleId==='TEXT_OVERFLOW')).toBe(true)
  })
  it('distingue contraste insuficiente',()=>{
    const value=canvas(new Textbox('Texto',{left:100,top:100,width:300,fontSize:40,fill:'#ffffff'}))
    expect(issues(value).some(f=>f.ruleId==='LOW_CONTRAST')).toBe(true)
  })
  it('não classifica sobreposição de fundo e texto como erro',()=>{
    const value=canvas(new Rect({left:80,top:80,width:500,height:200,fill:'#000000'}),new Textbox('Texto',{left:100,top:100,width:300,fontSize:40,fill:'#ffffff'}))
    expect(issues(value).some(f=>f.ruleId==='OVERLAP_REVIEW')).toBe(false)
  })
  it('avisa quando forma opaca cobre todo o texto',()=>{
    const value=canvas(new Textbox('Texto',{left:100,top:100,width:200,fontSize:40,originX:'left',originY:'top'}),new Rect({left:80,top:80,width:500,height:200,fill:'#000000',originX:'left',originY:'top'}))
    expect(issues(value).some(f=>f.ruleId==='OCCLUDED_TEXT')).toBe(true)
  })
  it('sinaliza sobreposição de dois textos para revisão',()=>{
    const value=canvas(new Textbox('Primeiro',{left:100,top:100,width:300,fontSize:40}),new Textbox('Segundo',{left:110,top:110,width:300,fontSize:40}))
    expect(issues(value).some(f=>f.ruleId==='OVERLAP_REVIEW')).toBe(true)
  })
  it('desliga exigência de marca por padrão',()=>{
    expect(issues(canvas()).some(f=>f.ruleId==='BRAND_MISSING')).toBe(false)
  })
  it('sinaliza campo obrigatório vazio em template',()=>{
    expect(inspectCanvas(canvas(),'s',1,defaultBrand,'cover','cover').some(f=>f.ruleId==='REQUIRED_FIELD')).toBe(true)
  })
  it('ignora caixas opcionais e duplicatas vazias quando a capa já tem conteúdo', () => {
    const value = canvas(new Textbox('Título', { semantic: 'title' }), new Textbox('Corpo', { semantic: 'body' }),
      new Textbox('', { semantic: 'cta' }), new Textbox('', { semantic: 'brand' }), new Textbox('  ', { semantic: 'title' }))
    expect(inspectCanvas(value, 's', 1, defaultBrand, 'photo', 'cover', undefined, [1080, 1350])
      .filter(f => f.ruleId === 'EMPTY_TEXT' || f.ruleId === 'REQUIRED_FIELD')).toEqual([])
  })
  it('localiza a caixa da chamada realmente vazia em um encerramento', () => {
    const value = canvas(new Textbox('Título', { semantic: 'title' }), new Textbox('', { semantic: 'body' }),
      new Textbox('', { semantic: 'cta' }))
    expect(inspectCanvas(value, 's', 1, defaultBrand, 'cta', 'cta', undefined, [1080, 1350])
      .filter(f => f.ruleId === 'EMPTY_TEXT')).toEqual([expect.objectContaining({ objectId: '2', details: expect.stringContaining('chamada para ação') })])
  })
  it('exige marca apenas quando ativada',()=>{
    expect(inspectCanvas(canvas(),'s',1,defaultBrand,'blank','content',{requireBrand:true,requireLogo:false,enforcePalette:false,minBodySize:24,minLargeSize:36,contrastNormal:4.5,contrastLarge:3}).some(f=>f.ruleId==='BRAND_MISSING')).toBe(true)
  })
  it('exige logotipo mesmo quando ainda não configurado',()=>{
    expect(inspectCanvas(canvas(),'s',1,defaultBrand,'blank','content',{requireBrand:false,requireLogo:true,enforcePalette:false,minBodySize:24,minLargeSize:36,contrastNormal:4.5,contrastLarge:3}).some(f=>f.ruleId==='LOGO_MISSING')).toBe(true)
  })
  it('marca fonte fora das fontes disponíveis',()=>{
    const value=canvas(new Textbox('Texto',{left:200,top:200,width:300,fontFamily:'Fonte inexistente 123',fontSize:40}))
    expect(issues(value).some(f=>f.ruleId==='FONT_UNAVAILABLE')).toBe(true)
  })
  it('mede a área nativa de uma imagem adequada',()=>{
    const source=document.createElement('canvas');source.width=400;source.height=300
    const image=new FabricImage(source,{left:200,top:200,width:400,height:300,scaleX:1,scaleY:1})
    expect(issues(canvas(image)).some(f=>f.ruleId==='IMAGE_RESOLUTION')).toBe(false)
  })
  it('avisa quando uma imagem é ampliada além da área nativa',()=>{
    const source=document.createElement('canvas');source.width=100;source.height=100
    const image=new FabricImage(source,{left:200,top:200,width:100,height:100,scaleX:3,scaleY:3})
    expect(issues(canvas(image)).some(f=>f.ruleId==='IMAGE_RESOLUTION')).toBe(true)
  })
  it('classifica contraste sobre imagem como inconclusivo',()=>{
    const source=document.createElement('canvas');source.width=500;source.height=500
    const image=new FabricImage(source,{left:80,top:80,width:500,height:500,originX:'left',originY:'top'})
    const text=new Textbox('Texto',{left:100,top:100,width:200,fontSize:40,fill:'#ffffff',originX:'left',originY:'top'})
    expect(issues(canvas(image,text)).some(f=>f.ruleId==='CONTRAST_UNKNOWN'&&f.confidence==='unverifiable')).toBe(true)
  })
  it('compõe opacidade de fundo sólido no contraste',()=>{
    const value=canvas(new Rect({left:80,top:80,width:500,height:200,fill:'rgba(0,0,0,0.5)',originX:'left',originY:'top'}),new Textbox('Texto',{left:100,top:100,width:200,fontSize:40,fill:'#ffffff',originX:'left',originY:'top'}))
    expect(issues(value).some(f=>f.ruleId==='CONTRAST_UNKNOWN')).toBe(false)
  })
  it('aplica correção reversível sem alterar conteúdo',async()=>{
    const project=newProject()
    const original=canvas(new Textbox('Título',{left:20,top:100,width:300,fontSize:50,fill:'#000000',originX:'left',originY:'top'}))
    project.slides[0].scene=original.toObject() as typeof project.slides[0]['scene']
    const finding=inspectCanvas(original,project.slides[0].id,1,project.brand,'blank','content').find(f=>f.ruleId==='SAFE_MARGIN')!
    const result=await prepareSafeMove(project,finding)
    expect(result.project.slides[0].scene.objects[0].text).toBe('Título')
    expect(result.project.slides[0].scene.objects[0].left).not.toBe(project.slides[0].scene.objects[0].left)
    expect(project.slides[0].scene.objects[0].left).toBe(20)
  })
  it('recusa correção sem espaço suficiente',async()=>{
    const project=newProject()
    const original=canvas(new Textbox('Texto',{left:20,top:100,width:1000,fontSize:50,originX:'left',originY:'top'}))
    project.slides[0].scene=original.toObject() as typeof project.slides[0]['scene']
    const finding=inspectCanvas(original,project.slides[0].id,1,project.brand,'blank','content').find(f=>f.ruleId==='SAFE_MARGIN')!
    expect(finding.autoFixAvailable).toBe(false)
    await expect(prepareSafeMove(project,finding)).rejects.toThrow('edição manual')
  })
  it('recusa correção se um elemento desaparece na hidratação do slide', async () => {
    const project = newProject()
    const original = canvas(new Textbox('Título', { left: 20, top: 100, width: 300, fontSize: 50, originX: 'left', originY: 'top' }), new Rect({ width: 25, height: 25 }))
    const slide = project.slides[0]
    slide.scene = original.toObject() as typeof slide.scene
    const finding = inspectCanvas(original, slide.id, 1, project.brand, slide.layout, slide.role).find(item => item.ruleId === 'SAFE_MARGIN')!
    const load = StaticCanvas.prototype.loadFromJSON
    const spy = vi.spyOn(StaticCanvas.prototype, 'loadFromJSON').mockImplementationOnce(function (this: StaticCanvas) {
      return load.call(this, { ...slide.scene, objects: slide.scene.objects.slice(0, 1) })
    })
    try {
      await expect(prepareSafeMove(project, finding)).rejects.toThrow('elementos que não puderam ser carregados')
    } finally {
      spy.mockRestore()
      await original.dispose()
    }
  })
})

import { describe, expect, it } from 'vitest'
import { defaultPreferences, importContent, markdownExample, newDraft } from '../campaigns/contract'
import { applyCollectionBrand, buildCollectionProject, collections, collectionBrand, composeCollection, demoSlides, imageForFrame } from './collections'
import { parseExpress } from './expressContent'
import { defaultBrand, dimensions } from './model'
import { validateProject } from './validation'

describe('coleções do Studio', () => {
  it('gera 48 composições distintas e editáveis em cada formato sem alterar o contrato v1', () => {
    expect(collections.filter(style => !style.premium)).toHaveLength(8)
    for (const format of ['portrait','square','story'] as const) {
      const geometries = new Set<string>()
      for (const style of collections.filter(item => !item.premium)) {
        const project = buildCollectionProject(style,format,defaultBrand,demoSlides.map((slide,composition) => ({...slide,composition})),style.name)
        expect(validateProject(project).slides).toHaveLength(6)
        for (const slide of project.slides) {
          const title = slide.scene.objects.find(item => item.semantic === 'title')!
          const picture = slide.scene.objects.find(item => item.semantic === 'imageFrame')!
          expect(String(title.type).toLowerCase()).toBe('textbox')
          expect(picture).toBeTruthy()
          geometries.add(JSON.stringify([title.left,title.top,title.width,picture.left,picture.top,picture.width,picture.height]))
        }
      }
      expect(geometries.size).toBe(48)
    }
  })
  it('mantém layout e texto ao aplicar marca e sinaliza texto longo inteiro', () => {
    const style = collections[2]
    const body = 'Linha longa para verificar o limite de tipografia. '.repeat(120)
    const { scene, issues } = composeCollection(style,3,{ title:'Marca em contexto', body },collectionBrand(style,defaultBrand),'square')
    const custom = { ...defaultBrand, primary:'#203050', background:'#eeeeee', name:'Estúdio', headingFont:'Georgia' }
    const edited = applyCollectionBrand(scene,custom,'square')
    expect(issues).toContain('body')
    expect(edited.background).toBe(custom.background)
    const title = edited.objects.find(item => item.semantic === 'title')!
    expect(title).toMatchObject({ fontFamily:'Georgia', fill:custom.primary, left:scene.objects.find(item => item.semantic === 'title')?.left })
    expect(edited.objects.find(item => item.semantic === 'body')?.text).toBe(body)
    expect(edited.objects.find(item => item.semantic === 'brand')?.text).toBe('Estúdio')
  })
  it('preenche a área com recorte central e preserva o objeto de origem', () => {
    const image = { width:800,height:400,src:'data:image/png;base64,AA==' }
    const result = imageForFrame(image,[80,100,200,300])
    expect(result.height*result.scaleY).toBeCloseTo(300)
    expect(result.width*result.scaleX).toBeCloseTo(200)
    expect(result.cropX).toBeGreaterThan(0)
    expect(image.width).toBe(800)
    expect(dimensions.portrait).toEqual([1080,1350])
  })
})

describe('entrada de texto da Produção Expressa', () => {
  it('interpreta Markdown e JSON de campanha com o validador original', () => {
    const markdown = parseExpress(markdownExample)
    expect(markdown.slides[0]).toMatchObject({ title:'Headline', body:'Texto da peça.', imageBrief:'Sugestão de imagem.' })
    expect(parseExpress(JSON.stringify(markdown.structured)).slides).toEqual(markdown.slides)
    expect(() => importContent(markdownExample,newDraft(null,defaultPreferences))).toThrow('Ajuste o briefing')
    expect(() => parseExpress('{ "slides": [] }')).toThrow('campos')
  })
  it('preserva parágrafos e deixa títulos ambíguos para revisão', () => {
    expect(parseExpress('Slide 1 — Abertura\nPrimeiro parágrafo.\n\nSegundo.\nSlide 2\nTexto sem título').slides)
      .toEqual([{title:'Abertura',body:'Primeiro parágrafo.\n\nSegundo.'},{title:'',body:'Texto sem título'}])
    expect(() => parseExpress(Array.from({length:21},(_,i) => `Slide ${i+1}\nConteúdo`).join('\n'))).toThrow('20 slides')
  })
})

describe('coleções premium', () => {
  it('preserva os 18 layouts, margens e gradiente serializável nos três formatos', () => {
    const premium = collections.filter(style => style.premium)
    expect(premium).toHaveLength(3)
    for (const format of ['portrait','square','story'] as const) {
      for (const style of premium) {
        const image = { type:'Image',width:1700,height:1450,src:'data:image/png;base64,AA==',originX:'left',originY:'top' }
        const project = buildCollectionProject(style,format,defaultBrand,demoSlides.map((sample,composition) => ({...sample,image,composition})),style.name)
        validateProject(project)
        const [width,height] = dimensions[format]
        expect(project.slides).toHaveLength(6)
        for (const slide of project.slides) {
          for (const item of slide.scene.objects.filter(object => typeof object.text === 'string')) {
            expect(Number(item.left)).toBeGreaterThanOrEqual(64)
            expect(Number(item.left)+Number(item.width)).toBeLessThanOrEqual(width-63)
            expect(Number(item.top)+Number(item.height)).toBeLessThanOrEqual(height-48)
          }
        }
        const objects = project.slides[0].scene.objects
        const overlay = objects.findIndex(object => object.semantic === (style.premium === 'card' ? 'editorialCard' : 'editorialGradient'))
        expect(overlay).toBeGreaterThan(objects.findIndex(object => object.semantic === 'image'))
        expect(overlay).toBeLessThan(objects.findIndex(object => object.semantic === 'title'))
        if (style.premium !== 'card') expect(objects[overlay].fill).toMatchObject({type:'linear'})
      }
    }
  })
  it('retém um título denso sem truncamento e informa quando ele não cabe', () => {
    const style = collections.find(item => item.premium === 'impact')!
    const title = 'Uma decisão de direção de arte precisa de contexto. '.repeat(14)
    const { scene, issues } = composeCollection(style,0,{title,body:'Contexto.'},collectionBrand(style,defaultBrand),'portrait','balanced')
    expect(scene.objects.find(object => object.semantic === 'title')?.text).toBe(title)
    expect(issues).toContain('title')
  })
})

import { FabricImage, Group, StaticCanvas, Textbox, type FabricObject } from 'fabric'
import type { Brand } from '../studio/model'
import { parseColor, composite, contrast } from './contrast'
import { defaultSettings, type AuditSettings, type Category, type Finding, type Severity } from './contract'
export type Located = { object: FabricObject; path: string; box: {left:number;top:number;width:number;height:number}; z: number }
export function locate(canvas: StaticCanvas): Located[] {
  const located: Located[] = []
  const visit=(objects: FabricObject[], prefix='') => objects.forEach((object,index)=>{
    const path=prefix?`${prefix}.${index}`:String(index)
    if (object instanceof Group) visit(object.getObjects(),path)
    else located.push({object,path,box:object.getBoundingRect(),z:located.length})
  })
  visit(canvas.getObjects()); return located
}
const intersects=(a: Located['box'],b:Located['box']) => Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top))
const contains=(a:Located['box'],b:Located['box']) => a.left<=b.left+1&&a.top<=b.top+1&&a.left+a.width>=b.left+b.width-1&&a.top+a.height>=b.top+b.height-1
export function inspectCanvas(canvas: StaticCanvas, slideId: string, slideNumber: number, brand: Brand, layout: string, role: string, options: AuditSettings=defaultSettings): Finding[] {
 const found: Finding[]=[]; const objects=locate(canvas), margin=brand.margin
 const add=(ruleId:string,severity:Severity,category:Category,item:Located|null,message:string,details:string,suggestion:string,fix=false,confidence:Finding['confidence']='measured')=>found.push({id:`${slideId}:${item?.path??'slide'}:${ruleId}`,ruleId,severity,category,slideId,slideNumber,objectId:item?.path??null,message,details,suggestion,autoFixAvailable:fix,confidence})
 const background=parseColor(canvas.backgroundColor)
 for(const item of objects){
  const {object:o,box}=item; const essential=['title','body','cta','brand'].includes(o.semantic??'')
  if(!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<=0||box.height<=0) add('INVALID_SIZE','error','geometry',item,'Dimensões inválidas','A largura ou altura calculada não é positiva.','Ajuste as dimensões manualmente.')
  if(Math.max(Math.abs(o.scaleX),Math.abs(o.scaleY))>10||Math.min(Math.abs(o.scaleX),Math.abs(o.scaleY))<.05) add('EXTREME_SCALE','warning','geometry',item,'Escala extrema',`Escala X ${o.scaleX.toFixed(2)}; Y ${o.scaleY.toFixed(2)}.`, 'Revise o tamanho do elemento.')
  if(box.left<0||box.top<0||box.left+box.width>canvas.width||box.top+box.height>canvas.height) add('OUTSIDE_CANVAS',essential?'error':'warning','geometry',item,'Elemento fora do canvas','Parte do elemento pode ser cortada na exportação.','Reposicione dentro do canvas.',!item.path.includes('.')&&!o.lockMovementX&&!o.lockMovementY&&box.width<=canvas.width&&box.height<=canvas.height)
  if(o instanceof Textbox){
    if(o.text.trim()&& (box.left<margin-1||box.top<margin-1||box.left+box.width>canvas.width-margin+1||box.top+box.height>canvas.height-margin+1)) add('SAFE_MARGIN','warning','geometry',item,'Texto fora da margem segura','Parte do texto está além da margem configurada.','Reposicione a caixa dentro da área segura.',!item.path.includes('.')&&!o.lockMovementX&&!o.lockMovementY&&box.width<=canvas.width-2*margin&&box.height<=canvas.height-2*margin)
    if(o.maxHeight&&o.getScaledHeight()>o.maxHeight+2) add('TEXT_OVERFLOW','error','typography',item,'Texto excede a área',`Altura ${Math.round(o.getScaledHeight())} px; limite ${Math.round(o.maxHeight)} px.`,'Amplie a caixa, troque o template ou reduza o texto editorialmente.')
    if(o.text.trim()&&(!o.visible||o.opacity===0)) add('TEXT_INVISIBLE','error','typography',item,'Texto invisível','O elemento contém texto, mas não aparece.','Torne o elemento visível ou remova-o.')
    const configured=['Inter','Arial','Georgia','Verdana','Courier New',...brand.fonts.map(f=>f.family)]
    if(!configured.includes(o.fontFamily)||!document.fonts.check(`${o.fontSize}px "${o.fontFamily}"`)) add('FONT_UNAVAILABLE','warning','typography',item,'Fonte não confirmada',`Fonte ${o.fontFamily}. O navegador pode usar uma substituta.`,'Carregue uma WOFF2 válida ou escolha uma fonte disponível.',false,'unverifiable')
    if(o.text.trim()&&o.fontSize*Math.min(Math.abs(o.scaleX),Math.abs(o.scaleY))<(o.semantic==='title'?options.minLargeSize:options.minBodySize)) add('SMALL_TEXT','warning','typography',item,'Texto pequeno',`Tamanho efetivo aproximado ${Math.round(o.fontSize*Math.min(Math.abs(o.scaleX),Math.abs(o.scaleY)))} px.`,'Aumente o tamanho da fonte.',false,'estimated')
    if(o.text.trim()&&o.charSpacing>500) add('TEXT_SPACING','warning','typography',item,'Espaçamento elevado','O espaçamento entre caracteres pode ampliar a caixa de texto.','Reduza o espaçamento e revise a quebra de linhas.',false,'estimated')
    if(o.text.trim()&&objects.some(later=>later.z>item.z&&contains(later.box,box)&&!(later.object instanceof Textbox)&&!(later.object instanceof FabricImage)&&!!parseColor(later.object.fill)&&later.object.opacity>=.98)) add('OCCLUDED_TEXT','warning','geometry',item,'Texto coberto por outra camada','Uma forma opaca acima do texto cobre toda a sua área geométrica.','Revise a ordem das camadas ou a visibilidade do texto.',false,'estimated')
    const textColor=parseColor(o.fill); let under=background; let uncertain=!under
    for(const prior of objects){ if(prior.z>=item.z)break; if(intersects(prior.box,box)<=0)continue
      if(prior.object instanceof FabricImage||!contains(prior.box,box)){uncertain=true;continue}
      const solid=parseColor(prior.object.fill); if(!solid){uncertain=true;continue}
      if(under)under=composite([solid[0],solid[1],solid[2],solid[3]*prior.object.opacity],under)
    }
    if(textColor&&under&&!uncertain){const ratio=contrast(composite([textColor[0],textColor[1],textColor[2],textColor[3]*o.opacity],under),under);const threshold=o.fontSize*o.scaleY>=options.minLargeSize?options.contrastLarge:options.contrastNormal
      if(ratio<threshold) add('LOW_CONTRAST','warning','contrast',item,'Contraste abaixo do limite',`Razão calculada ${ratio.toFixed(2)}:1; referência ${threshold}:1.`,'Ajuste a cor ou o fundo após revisar a identidade visual.')
    } else if(o.text.trim()) add('CONTRAST_UNKNOWN','info','contrast',item,'Contraste requer revisão visual','Há fotografia, gradiente, transparência ou camadas que impedem medição confiável.','Confira a legibilidade na prévia e no PNG.',false,'unverifiable')
  }
  if(o instanceof FabricImage){
    const original=o.getOriginalSize(), effectiveW=o.width, effectiveH=o.height
    const element=o.getElement(); if(element instanceof HTMLImageElement&&!element.complete||!original.width||!original.height) add('IMAGE_MISSING','error','image',item,'Imagem indisponível','A imagem não foi carregada completamente.','Substitua o arquivo local.')
    if(o.cropX<0||o.cropY<0||o.cropX+effectiveW>original.width+1||o.cropY+effectiveH>original.height+1) add('IMAGE_CROP','warning','image',item,'Recorte fora da imagem','Parte do recorte ultrapassa a imagem original.','Revise o enquadramento.')
    if(effectiveW+1<o.getScaledWidth()||effectiveH+1<o.getScaledHeight()) add('IMAGE_RESOLUTION','warning','image',item,'Resolução insuficiente',`Imagem usada ${Math.round(effectiveW)}×${Math.round(effectiveH)} px; ocupa ${Math.round(o.getScaledWidth())}×${Math.round(o.getScaledHeight())} px.`,'Diminua a imagem ou substitua por arquivo maior.')
    const src=o.getSrc(); if(src&&!src.startsWith('data:image/'))add('UNVERIFIABLE_IMAGE','warning','image',item,'Origem da imagem não confirmada','A imagem externa pode impedir a exportação.','Substitua por imagem local.',false,'unverifiable')
  }
  if(o.semantic==='imageHint')add('IMAGE_MISSING','warning','image',item,'Imagem prevista ausente','O template ainda contém o espaço reservado.','Insira uma imagem local.')
  if(options.enforcePalette&&typeof o.fill==='string'&&!['imageHint','imageFrame'].includes(o.semantic??'')&&![brand.primary,brand.secondary,brand.background,'#ffffff'].includes(o.fill.toLowerCase()))add('PALETTE','info','branding',item,'Cor fora da paleta','A opção de paleta foi ativada.','Confirme se esta variação é intencional.',false,'estimated')
 }
 const semantic=(name:string)=>objects.some(i=>i.object.semantic===name&&(!(i.object instanceof Textbox)||i.object.text.trim()))
 if(layout!=='blank'&&!semantic('title'))add('REQUIRED_FIELD','warning','branding',null,'Título ausente','O template não tem título preenchido.','Escreva um título ou escolha outro template.')
 if(role==='cta'&&!semantic('cta'))add('REQUIRED_FIELD','warning','branding',null,'CTA ausente','O slide de encerramento não tem chamada preenchida.','Escreva uma chamada para ação.')
 if(options.requireBrand&&(!brand.name&&!brand.handle||!semantic('brand')))add('BRAND_MISSING','warning','branding',null,'Marca ausente','Este projeto exige identificação de marca.','Configure e adicione o nome ou identificador da marca.')
 if(options.requireLogo&&(!brand.logo||!semantic('logo')))add('LOGO_MISSING','warning','branding',null,'Logotipo ausente','Este projeto exige logotipo.','Configure e adicione o logotipo da marca.')
 for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
  const a=objects[i],b=objects[j];if(!(a.object instanceof Textbox&&b.object instanceof Textbox))continue
  if(!a.object.text.trim()||!b.object.text.trim())continue
  const intersection=intersects(a.box,b.box);if(intersection>Math.min(a.box.width*a.box.height,b.box.width*b.box.height)*.15)add('OVERLAP_REVIEW','warning','geometry',b,'Textos possivelmente sobrepostos',`Interseção geométrica com o elemento ${a.path}; intenção não verificável.`,'Revise visualmente a composição.',false,'estimated')
 }
 return found
}

import { StaticCanvas } from 'fabric'
import { dimensions, type Project } from '../studio/model'
import '../studio/objects'
import { inspectCanvas } from './rules'
import { defaultSettings, type Finding } from './contract'

export async function prepareSafeMove(project: Project, finding: Finding): Promise<{project: Project; description: string}> {
  if (!finding.autoFixAvailable || !finding.objectId || finding.objectId.includes('.') || !['OUTSIDE_CANVAS','SAFE_MARGIN'].includes(finding.ruleId)) throw Error('Esta ocorrência exige edição manual.')
  const slideIndex = project.slides.findIndex(slide => slide.id === finding.slideId)
  if (slideIndex < 0) throw Error('Slide não encontrado.')
  const slide = project.slides[slideIndex]
  const [width,height] = dimensions[project.format]
  const canvas = new StaticCanvas(document.createElement('canvas'), {width,height,enableRetinaScaling:false})
  try {
    await canvas.loadFromJSON(slide.scene)
    const object = canvas.getObjects()[Number(finding.objectId)]
    if (!object || object.lockMovementX || object.lockMovementY) throw Error('Elemento bloqueado ou alterado. Execute uma nova auditoria.')
    const box = object.getBoundingRect()
    const margin = project.brand.margin
    const minX = finding.ruleId === 'SAFE_MARGIN' ? margin : 0
    const minY = finding.ruleId === 'SAFE_MARGIN' ? margin : 0
    const maxX = width - minX, maxY = height - minY
    if (box.width > maxX-minX || box.height > maxY-minY) throw Error('O elemento não cabe na área segura. Ajuste manualmente.')
    const dx = box.left < minX ? minX-box.left : box.left+box.width > maxX ? maxX-box.left-box.width : 0
    const dy = box.top < minY ? minY-box.top : box.top+box.height > maxY ? maxY-box.top-box.height : 0
    if (!dx && !dy) throw Error('A posição mudou. Execute uma nova auditoria.')
    object.set({left:object.left+dx,top:object.top+dy});object.setCoords()
    const remaining = inspectCanvas(canvas,slide.id,slideIndex+1,project.brand,slide.layout,slide.role,project.auditSettings??defaultSettings)
    if (remaining.some(issue => issue.id === finding.id)) throw Error('A correção não eliminou o problema. Ajuste manualmente.')
    const scene = canvas.toObject() as typeof slide.scene
    if (slide.scene.contentImage) scene.contentImage = slide.scene.contentImage
    return {project:{...project,updatedAt:new Date().toISOString(),slides:project.slides.map((s,i)=>i===slideIndex?{...s,scene}:s)},description:`Mover ${Math.round(dx)} px na horizontal e ${Math.round(dy)} px na vertical.`}
  } finally {await canvas.dispose()}
}

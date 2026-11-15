import { StaticCanvas } from 'fabric'
import { dimensions, type VisualSlide } from '../studio/model'
import { loadFonts } from '../studio/fonts'
import { verifySceneLoaded } from '../studio/sceneIntegrity'
import { defaultSettings, rules, type AuditReport, type AuditTarget, type Finding } from './contract'
import { inspectCanvas } from './rules'

async function diagnoseUnreadableImages(slide: VisualSlide, slideNumber: number, signal?: AbortSignal) {
  const findings: Finding[] = []
  async function inspect(objects: Record<string, unknown>[], prefix = '') {
    for (const [index, object] of objects.entries()) {
      signal?.throwIfAborted()
      const path = prefix ? prefix + '.' + index : String(index)
      if (Array.isArray(object.objects)) await inspect(object.objects, path)
      if (String(object.type).toLowerCase() !== 'image') continue
      const src = typeof object.src === 'string' ? object.src : ''
      if (src && !src.startsWith('data:image/')) continue
      const image = new Image()
      try {
        image.src = src
        await image.decode()
        continue
      } catch { /* Decoding the original local data failed independently of Fabric. */ }
      const ruleId = src ? 'IMAGE_CORRUPT' : 'IMAGE_MISSING'
      findings.push({ id: `${slide.id}:${path}:${ruleId}`, ruleId, severity: 'error', category: 'image', slideId: slide.id,
        slideNumber, objectId: path, message: src ? 'Arquivo de imagem ilegível' : 'Arquivo de imagem ausente',
        details: 'O slide não pôde ser renderizado. A imagem local não foi decodificada.',
        suggestion: 'Restaure um backup íntegro ou substitua o arquivo.', autoFixAvailable: false, confidence: 'measured' })
    }
  }
  await inspect(slide.scene.objects)
  return findings
}
export async function auditProject({project,slideIndex,settings=project.auditSettings??defaultSettings,signal,progress}:AuditTarget):Promise<AuditReport>{
 await loadFonts(project.brand)
 const indices=slideIndex===undefined?project.slides.map((_,i)=>i):[slideIndex]
 const findings:AuditReport['findings']=[]
 for(const [done,index] of indices.entries()){
  if(signal?.aborted)throw new DOMException('Auditoria cancelada','AbortError')
  const slide=project.slides[index];if(!slide)throw Error('Slide não encontrado.')
  const canvas=new StaticCanvas(document.createElement('canvas'),{width:dimensions[project.format][0],height:dimensions[project.format][1],enableRetinaScaling:false})
  try {
    try { await canvas.loadFromJSON(slide.scene, undefined, { signal }); verifySceneLoaded(canvas, slide.scene) }
    catch (cause) {
      signal?.throwIfAborted()
      const files = await diagnoseUnreadableImages(slide, index+1, signal)
      if (!files.length) throw cause
      findings.push(...files)
      continue
    }
    canvas.renderAll()
    findings.push(...inspectCanvas(canvas, slide.id, index+1, project.brand, slide.layout, slide.role, settings))
    await new Promise(resolve => setTimeout(resolve, 0))
  } finally { await canvas.dispose(); progress?.(done+1, indices.length) }
 }
 return {projectId:project.id,projectName:project.name,documentVersion:project.schemaVersion,projectUpdatedAt:project.updatedAt,analyzedAt:new Date().toISOString(),totalSlides:indices.length,rules,findings,unverifiable:findings.filter(f=>f.confidence==='unverifiable').map(f=>f.id),corrections:[],status:findings.some(f=>f.severity==='error')?'errors':findings.some(f=>f.severity==='warning'||f.confidence==='unverifiable')?'review':'clear'}
}

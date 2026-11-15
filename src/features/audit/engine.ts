import { StaticCanvas } from 'fabric'
import { dimensions } from '../studio/model'
import { loadFonts } from '../studio/fonts'
import { defaultSettings, rules, type AuditReport, type AuditTarget } from './contract'
import { inspectCanvas } from './rules'
export async function auditProject({project,slideIndex,settings=project.auditSettings??defaultSettings,signal,progress}:AuditTarget):Promise<AuditReport>{
 await loadFonts(project.brand)
 const indices=slideIndex===undefined?project.slides.map((_,i)=>i):[slideIndex]
 const findings:AuditReport['findings']=[]
 for(const [done,index] of indices.entries()){
  if(signal?.aborted)throw new DOMException('Auditoria cancelada','AbortError')
  const slide=project.slides[index];if(!slide)throw Error('Slide não encontrado.')
  const canvas=new StaticCanvas(document.createElement('canvas'),{width:dimensions[project.format][0],height:dimensions[project.format][1],enableRetinaScaling:false})
  try{await canvas.loadFromJSON(slide.scene,undefined,{signal});canvas.renderAll();findings.push(...inspectCanvas(canvas,slide.id,index+1,project.brand,slide.layout,slide.role,settings));await new Promise(resolve=>setTimeout(resolve,0))}finally{await canvas.dispose()}
  progress?.(done+1,indices.length)
 }
 return {projectId:project.id,projectName:project.name,documentVersion:project.schemaVersion,projectUpdatedAt:project.updatedAt,analyzedAt:new Date().toISOString(),totalSlides:indices.length,rules,findings,unverifiable:findings.filter(f=>f.confidence==='unverifiable').map(f=>f.id),corrections:[],status:findings.some(f=>f.severity==='error')?'errors':findings.some(f=>f.severity==='warning'||f.confidence==='unverifiable')?'review':'clear'}
}

import { loadFonts } from './fonts'
import { StaticCanvas } from 'fabric'
import JSZip from 'jszip'
import { dimensions, type Project, type Scene } from './model'
import { inspectCanvas } from '../audit/rules'
import { defaultSettings, type Finding } from '../audit/contract'
import { projectCredits } from '../images/credits'
import { verifySceneLoaded } from './sceneIntegrity'
import './objects'
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000) }
export async function renderScene(scene: Scene, width: number, height: number, options: { scale?: number; signal?: AbortSignal; audit?: (canvas: StaticCanvas) => Finding[] } = {}) {
  const { scale = 1, signal, audit } = options
  await document.fonts.ready
  signal?.throwIfAborted()
  const element = document.createElement('canvas')
  const canvas = new StaticCanvas(element, { width: Math.round(width * scale), height: Math.round(height * scale), enableRetinaScaling: false, renderOnAddRemove: false })
  try {
    await canvas.loadFromJSON(scene, undefined, { signal })
    verifySceneLoaded(canvas, scene)
    if (scale !== 1) canvas.setZoom(scale)
    canvas.renderAll()
    const findings = audit?.(canvas) ?? []
    const blob = await new Promise<Blob>((resolve, reject) => element.toBlob(value => value ? resolve(value) : reject(Error('Não foi possível exportar a imagem. Substitua imagens externas ou inválidas.')), 'image/png'))
    return { blob, findings }
  } finally { await canvas.dispose() }
}
export async function exportProject(project: Project, current?: number) {
  await loadFonts(project.brand)
  const [width, height] = dimensions[project.format]
  const slides = current === undefined ? project.slides : [project.slides[current]]
  const zip = current === undefined ? new JSZip() : undefined
  const warnings: string[] = []; const findings: Finding[] = []; let png: Blob | undefined
  const credits = projectCredits(project, current)
  if (credits) zip?.file('creditos.txt', credits)
  const name = project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'post-machine'
  for (const [index, slide] of slides.entries()) {
    const result = await renderScene(slide.scene, width, height, { audit: canvas => inspectCanvas(canvas, slide.id, (current ?? index)+1, project.brand, slide.layout, slide.role, project.auditSettings ?? defaultSettings) })
    png = result.blob; findings.push(...result.findings); warnings.push(...result.findings.filter(f => f.severity !== 'info').map(f => `Slide ${f.slideNumber}: ${f.message}. ${f.details}`))
    if (zip) zip.file(`${String(index+1).padStart(2,'0')}-${name}.png`, await result.blob.arrayBuffer())
  }
  return { blob: zip ? await zip.generateAsync({ type: 'blob' }) : png!, name: `${name}${current === undefined ? '.zip' : `-${String(current+1).padStart(2,'0')}.png`}`, warnings, findings, credits, source: project }
}

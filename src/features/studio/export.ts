import { loadFonts } from './fonts'
import { StaticCanvas, FabricImage, Textbox, Group } from 'fabric'
import JSZip from 'jszip'
import { dimensions, type Project, type Scene } from './model'
import './objects'
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000) }
export function checkCanvas(canvas: StaticCanvas, margin: number) {
  const warnings: string[] = []
  const width = canvas.width, height = canvas.height
  const flatten = (objects: ReturnType<StaticCanvas['getObjects']>): ReturnType<StaticCanvas['getObjects']> => objects.flatMap(o => o instanceof Group ? flatten(o.getObjects()) : [o])
  flatten(canvas.getObjects()).forEach((o, i) => {
    const box = o.getBoundingRect(); const label = `Elemento ${i+1}`
    if (box.left < -1 || box.top < -1 || box.left + box.width > width + 1 || box.top + box.height > height + 1) warnings.push(`${label}: fora do canvas.`)
    if (o instanceof Textbox) {
      if (o.maxHeight && o.getScaledHeight() > o.maxHeight + 2) warnings.push(`${label}: texto excede a área; edite ou troque o template.`)
      if (box.left < margin - 1 || box.top < margin - 1 || box.left + box.width > width - margin + 1 || box.top + box.height > height - margin + 1) warnings.push(`${label}: texto fora da margem segura.`)
      if (!document.fonts.check(`${o.fontSize}px "${o.fontFamily}"`)) warnings.push(`${label}: fonte indisponível.`)
    }
    if (o instanceof FabricImage && (o.width < o.getScaledWidth() || o.height < o.getScaledHeight())) warnings.push(`${label}: resolução da imagem insuficiente para o tamanho ocupado.`)
    if (o.semantic === 'imageHint') warnings.push(`${label}: espaço de imagem ainda não preenchido.`)
  })
  return warnings
}
export async function renderScene(scene: Scene, width: number, height: number, margin: number, scale = 1) {
  const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, enableRetinaScaling: false })
  try {
    await document.fonts.ready
    await canvas.loadFromJSON(scene)
    canvas.renderAll()
    const warnings = checkCanvas(canvas, margin)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toCanvasElement(scale).toBlob(value => value ? resolve(value) : reject(Error('Não foi possível exportar a imagem. Substitua imagens externas ou inválidas.')), 'image/png'))
    return { blob, warnings }
  } finally { await canvas.dispose() }
}
export async function exportProject(project: Project, current?: number) {
  await loadFonts(project.brand)
  const [width, height] = dimensions[project.format]
  const slides = current === undefined ? project.slides : [project.slides[current]]
  const zip = new JSZip(); const warnings: string[] = []; let png: Blob | undefined
  const name = project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'direto'
  for (const [index, slide] of slides.entries()) {
    const result = await renderScene(slide.scene, width, height, project.brand.margin)
    png = result.blob; warnings.push(...result.warnings.map(w => `Slide ${(current ?? index)+1}: ${w}`))
    zip.file(`${String(index+1).padStart(2,'0')}-${name}.png`, await result.blob.arrayBuffer())
  }
  return { blob: current === undefined ? await zip.generateAsync({ type: 'blob' }) : png!, name: `${name}${current === undefined ? '.zip' : `-${String(current+1).padStart(2,'0')}.png`}`, warnings }
}

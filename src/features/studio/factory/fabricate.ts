import { collectionBrand, composeCollection, type Collection } from '../collections'
import { loadFonts } from '../fonts'
import { dimensions, newProject, type Brand, type Format, type Project } from '../model'
import { planSlides, compositionPreference, type Asset, type Input, type PlannedSlide, type Treatment } from './planning'
import { evaluateScene, type Issue } from './evaluate'
import type { AuthorTemplate } from '../authorTemplate'
import type { VisualAnalysis } from '../vision/signals'

export const treatments: Treatment[] = ['balanced','photo','expressive']
export const candidateLimitPerSlide = 18
export type FactoryInput = { style: Collection; format: Format; brand: Brand; slides: Input[]; assets: Asset[]; author?: AuthorTemplate; visual?: ReadonlyMap<string, VisualAnalysis> }
export type VersionSlide = { composition: number; issues: Issue[] }
export type Proposal = { treatment: Treatment; project: Project; details: VersionSlide[] }
export type Fabrication = { proposals: Proposal[]; slides: PlannedSlide[]; collection: string; elapsed: number; candidates: number }

export function planFactoryImages(input: FactoryInput) {
  const [width, height] = dimensions[input.format]
  const frame = input.style.layouts[3]?.image
  const imageRatio = frame?.[3] ? frame[2] * width / (frame[3] * height) : undefined
  return planSlides(input.slides, input.assets, { width, height, imageRatio }, input.visual)
}

function unavailableFonts(brand: Brand): Set<string> {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const test = 'MWi1âÇ Texto editorial 123'
  const measure = (font: string) => {
    if (!context) return 0
    context.font = `48px ${font}`
    return context.measureText(test).width
  }
  return new Set([brand.headingFont,brand.bodyFont].filter(font => {
    if (!document.fonts.check(`48px "${font}"`,test)) return true
    return !!context && ['monospace','serif'].every(fallback => measure(`"${font}", ${fallback}`) === measure(fallback))
  }))
}

function makeCandidate(input: FactoryInput, brand: Brand, slide: PlannedSlide, index: number, composition: number, treatment: Treatment, missing: Set<string>) {
  const { scene, measurements } = composeCollection(input.style,composition,slide.content,brand,input.format,treatment)
  const assessment = evaluateScene(scene,measurements,slide,input.format,brand,missing)
  const preference = compositionPreference(slide,index,composition)
  let score = preference - assessment.penalty
  if (slide.visualPlaceholder && !slide.picture && scene.objects.some(object => object.semantic === 'imageFrame')) score += 28
  const title = measurements.find(metric => metric.field === 'title')
  const body = measurements.find(metric => metric.field === 'body')
  const cta = measurements.find(metric => metric.field === 'cta')
  if (slide.role === 'cover' && title?.fits) score += Math.min(9, title.size / Math.max(1, body?.size ?? 30) * 3)
  if (slide.role === 'content' && body?.fits) score += Math.min(8, body.size / body.preferred * 7)
  if (slide.role === 'cta' && cta?.fits) score += Math.min(8, cta.size / cta.preferred * 8)
  if (treatment === 'photo') score += slide.picture ? assessment.imageArea*78 + assessment.retained*12 : assessment.textArea*28
  if (treatment === 'expressive') score += assessment.titleSize*.23 + (composition === 4 ? 4 : 0)
  if (treatment === 'balanced') score += Math.min(.26,assessment.textArea)*18 + assessment.retained*5
  return { scene, composition, issues:assessment.issues, score }
}

const definition = (style: Collection, composition: number) => ['collection-v1',style.id,composition].join(':')

export async function fabricate(input: FactoryInput, signal: AbortSignal, progress: (complete: number,total: number) => void) {
  if (!input.slides.length || input.slides.length > 20) throw Error('A fabricação aceita de 1 a 20 slides.')
  const started = performance.now()
  const brand = collectionBrand(input.style,input.brand)
  await loadFonts(brand)
  signal.throwIfAborted()
  const missing = unavailableFonts(brand)
  const slides = planFactoryImages(input)
  const proposals: Proposal[] = treatments.map(treatment => ({
    treatment, project:{ ...newProject(input.format),brand:input.style.premium ? brand : input.brand,slides:[] }, details:[],
  }))
  let candidates = 0
  let lastYield = performance.now()
  for (const [index,slide] of slides.entries()) {
    const chosen: number[] = []
    for (const proposal of proposals) {
      const last = proposal.details.at(-1)?.composition
      const options = []
      for (let composition=0;composition<input.style.layouts.length;composition++) {
        signal.throwIfAborted()
        const candidate = makeCandidate(input,brand,slide,index,composition,proposal.treatment,missing)
        candidate.score -= (last === composition ? 4 : 0) + (chosen.includes(composition) ? 5 : 0)
        options.push(candidate)
        candidates++
        if (performance.now()-lastYield >= 10) {
          await new Promise<void>(resolve => setTimeout(resolve,0))
          lastYield = performance.now()
        }
      }
      const selected = options.sort((a,b) => b.score-a.score || a.composition-b.composition)[0]
      chosen.push(selected.composition)
      proposal.details.push({ composition:selected.composition,issues:selected.issues })
      proposal.project.slides.push({
        id:crypto.randomUUID(), role:slide.role, layout:definition(input.style,selected.composition),
        imageBrief:slide.content.imageBrief ?? '', visualContext:slide.content.visualContext, scene:selected.scene,
      })
    }
    progress(index+1,slides.length)
  }
  signal.throwIfAborted()
  return { proposals, slides, collection:input.style.name, elapsed:performance.now()-started, candidates } satisfies Fabrication
}

export function recompose(input: FactoryInput, planned: PlannedSlide, proposal: Proposal, index: number, composition: number): Proposal {
  const brand = collectionBrand(input.style,input.brand)
  const generated = makeCandidate(input,brand,planned,index,composition,proposal.treatment,unavailableFonts(brand))
  const slides = proposal.project.slides.map((slide,i) => i === index ?
    { ...slide, layout:definition(input.style,composition),scene:generated.scene } : slide)
  return { ...proposal, project:{ ...proposal.project,slides }, details:proposal.details.map((detail,i) =>
    i === index ? { composition,issues:generated.issues } : detail) }
}

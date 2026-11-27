import { createSemanticSession, type SemanticRequest } from '../src/features/images/semanticClient'
import { requestFor, type VisualRequest } from '../src/features/images/automaticSearch'
import { campaignContext, type VisualCopy } from '../src/features/images/visualContext'
import { investigateVisuals } from '../src/features/images/searchOrchestrator'
import '../src/features/studio/objects'

type Pauta = { id: string; title: string; url: string; imageBrief: string; detail?: string; slides?: VisualCopy[]; language?: 'en' | 'pt' }
type Version = 'old' | 'a' | 'evolution14-reference' | 'evolution142-reference' | 'evolution14-local' | 'closure-next' | 'next'
type Selection = { slide: number; url?: string; source?: string; classification?: string; fingerprint?: string }
const historical = (version: Exclude<Version, 'next'>, module: string) =>
  import(/* @vite-ignore */ `/benchmarks/.baseline/${version}/src/features/images/${module}.ts`)

export async function replay(version: Version, item: Pauta) {
  const copy: VisualCopy[] = item.slides ?? [{ title: item.title, imageBrief: item.imageBrief, role: 'cover' }]
  if (!item.slides && item.detail) copy.push({ title: item.detail, imageBrief: item.detail, role: 'content' })
  const project = version + '-' + item.id
  const contextInput = { title: item.title, sources: [{ title: item.title, url: item.url }], slides: copy,
    visual: item.language ? { language: item.language } : undefined }
  const used = new Set<string>()
  const output: Selection[] = []
  const status: Record<string, string> = {}
  const traces: { stage: string; slide?: string; reason?: string; url?: string }[] = []
  const ctx = performance as Performance & { memory?: { usedJSHeapSize: number } }
  const start = performance.now()
  let firstMs: number | null = null
  const signal = AbortSignal.timeout(28_000)
  if (version === 'old') {
    const { visualQueries, findAutomaticImage } = await historical('old', 'automaticSearch')
    for (const [index, slide] of copy.entries()) {
      const intent = visualQueries({ ...slide, campaign: item.title, sourcePage: item.url, ratio: .8 })
      const image = await findAutomaticImage(intent, signal, used, () => undefined).catch(() => undefined)
      if (!image) continue
      firstMs ??= performance.now() - start
      for (const key of image.keys) used.add(key)
      output.push({ slide: index, url: image.object.imageCredit?.originalUrl, source: image.object.imageCredit?.sourcePage,
        classification: image.match.strategy })
    }
  } else {
    const reference = version === 'evolution14-reference' || version === 'evolution142-reference' || version === 'evolution14-local' || version === 'closure-next'
    const buildContext: typeof campaignContext = reference ? (await historical(version, 'visualContext')).campaignContext : campaignContext
    const buildRequest: typeof requestFor = reference ? (await historical(version, 'automaticSearch')).requestFor : requestFor
    const campaign = buildContext(contextInput)
    const requests = copy.flatMap((slide, index) => {
      const request = buildRequest(project + '/' + index, slide, campaign, .8, 0, copy.slice(Math.max(0, index - 1), index + 2).filter(other => other !== slide))
      return request ? [request] : []
    })
    const investigate: typeof investigateVisuals = version !== 'next' ? (await historical(version, 'searchOrchestrator')).investigateVisuals : investigateVisuals
    await investigate(requests, {
      used: () => used,
      image: (request: VisualRequest, image) => {
        firstMs ??= performance.now() - start
        image.keys.forEach(key => used.add(key))
        const credit = image.object.imageCredit as { originalUrl?: string; sourcePage?: string } | undefined
        const slide = Number(request.slideId)
        const existing = output.findIndex(entry => entry.slide === slide)
        const selected = { slide, url: credit?.originalUrl, source: credit?.sourcePage,
          classification: image.match.classification, fingerprint: image.fingerprint }
        if (existing < 0) output.push(selected)
        else output[existing] = selected
      },
      finish: (request, state) => { status[request.slideId] = state },
      trace: event => { if (traces.length < 500) traces.push(event) },
    }, signal)
  }
  return { firstMs, totalMs: performance.now() - start, heap: ctx.memory?.usedJSHeapSize, output, status, traces }
}

export async function oldQueries(item: Pauta) {
  const { visualQueries } = await historical('old', 'automaticSearch')
  return visualQueries({ title: item.title, imageBrief: item.imageBrief, role: 'cover',
    campaign: item.title, sourcePage: item.url, ratio: .8 }).stages[0].query as string
}

let model: ReturnType<typeof createSemanticSession> | undefined
export function startModel(name: SemanticRequest['model']) { model = createSemanticSession(name) }
export function closeModel() { model?.close(); model = undefined }
export async function compareModels(urls: string[], prompts: string[]) {
  const images = await Promise.all(urls.map(async url => {
    const response = await fetch(url)
    if (!response.ok) throw Error('Candidato indisponível.')
    return { key: url, file: await response.blob() }
  }))
  return model!.compare(images, prompts, AbortSignal.timeout(55_000))
}

export async function runOcr(url: string) {
  const file = await fetch(url).then(response => response.blob())
  const { readVisualText } = await import('../src/features/images/ocr')
  const start = performance.now()
  return { ...await readVisualText(file, 'eng', AbortSignal.timeout(10_000)), ms: performance.now() - start }
}

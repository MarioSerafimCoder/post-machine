import { createSemanticSession, type SemanticRequest } from '../src/features/images/semanticClient'
import { requestFor, type VisualRequest } from '../src/features/images/automaticSearch'
import { campaignContext, type VisualCopy } from '../src/features/images/visualContext'
import { investigateVisuals } from '../src/features/images/searchOrchestrator'
import '../src/features/studio/objects'

type Pauta = { id: string; title: string; url: string; imageBrief: string; detail?: string }
type Version = 'old' | 'a' | 'next'
const historical = (version: 'old' | 'a', module: string) =>
  import(/* @vite-ignore */ `/benchmarks/.baseline/${version}/src/features/images/${module}.ts`)

export async function replay(version: Version, item: Pauta) {
  const copy: VisualCopy[] = [{ title: item.title, imageBrief: item.imageBrief, role: 'cover' }]
  if (item.detail) copy.push({ title: item.detail, imageBrief: item.detail, role: 'content' })
  const project = version + '-' + item.id
  const campaign = campaignContext({ title: item.title, sources: [{ title: item.title, url: item.url }], slides: copy })
  const used = new Set<string>()
  const output = []
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
    const requests = copy.map((slide, index) => requestFor(project + '/' + index, slide, campaign, .8, 0, copy.filter(other => other !== slide))!)
    const investigate: typeof investigateVisuals = version === 'a' ? (await historical('a', 'searchOrchestrator')).investigateVisuals : investigateVisuals
    await investigate(requests, {
      used: () => used,
      image: (request: VisualRequest, image) => {
        firstMs ??= performance.now() - start
        image.keys.forEach(key => used.add(key))
        const credit = image.object.imageCredit as { originalUrl?: string; sourcePage?: string } | undefined
        output.push({ slide: Number(request.slideId), url: credit?.originalUrl, source: credit?.sourcePage,
          classification: image.match.classification, fingerprint: image.fingerprint })
      },
      finish: () => undefined,
    }, signal)
  }
  return { firstMs, totalMs: performance.now() - start, heap: ctx.memory?.usedJSHeapSize, output }
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

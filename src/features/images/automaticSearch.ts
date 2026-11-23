import { z } from 'zod'
import { licenseTerms, toCredit, type ImageResult } from './contract'
import { automaticOriginal, fetchOriginal, searchImages } from './openverse'
import { normalize } from '../radar/contract'
import { readImage } from '../studio/images'
import { contrastFocalPoint } from '../studio/vision/signals'

export const matchSchema = z.object({
  strategy: z.enum(['documental', 'documental-expandida', 'editorial']),
  reason: z.string().max(500),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/).optional(),
})
export type VisualMatch = z.infer<typeof matchSchema>
export const visualChoiceSchema = z.object({
  mode: z.enum(['automatic', 'manual', 'locked', 'none']),
  match: matchSchema.optional(),
  signature: z.string().max(1500).optional(),
  revision: z.number().int().nonnegative().optional(),
})
export type VisualChoice = z.infer<typeof visualChoiceSchema>
export type VisualIntent = { title: string; body?: string; subtitle?: string; cta?: string; imageBrief?: string; role?: string; campaign?: string; ratio?: number }
export type VisualStatus = 'documental' | 'editorial' | 'empty' | 'error'

function visualFingerprint(image: ImageData) {
  const sample = (column: number, row: number) => {
    const x = Math.round(column / 8 * (image.width - 1))
    const y = Math.round((row + .5) / 8 * (image.height - 1))
    const at = (y * image.width + x) * 4
    return .21 * image.data[at] + .72 * image.data[at + 1] + .07 * image.data[at + 2]
  }
  let hash = 0n
  let visibleEdges = 0
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    const difference = sample(column, row) - sample(column + 1, row)
    hash = (hash << 1n) | (difference > 2 ? 1n : 0n)
    if (Math.abs(difference) > 8) visibleEdges++
  }
  return visibleEdges >= 9 ? hash.toString(16).padStart(16, '0') : undefined
}

function similarImage(fingerprint: string, used: ReadonlySet<string>) {
  for (const item of used) {
    if (!/^foto:[0-9a-f]{16}$/.test(item)) continue
    let bits = BigInt('0x' + fingerprint) ^ BigInt('0x' + item.slice(5))
    let difference = 0
    while (bits && difference <= 4) { bits &= bits - 1n; difference++ }
    if (difference <= 4) return true
  }
  return false
}

const generic = new Set('a as o os ao aos um uma umas uns de da das do dos no na nas nos em por para com sem que como mais sua seu suas seus sobre tema imagem imagens foto fotografia mostrar ilustrar slide cena exemplo exemplos conceito ideias ideia design editorial conteudo trabalho formato chamada acao usar veja saiba salve fez fazer parte proposta acontece ganharam reune the and for from with image photo show this that using'.split(' '))
const conceptual = /\b(conceitual|conceptual|metafora|metaphor|abstrat\w*|abstract|ilustrac\w*|illustration|render(?:ing)?|mockup|collage|montagem|ai generated|gerad[ao] por ia|generative ai|3d|vector|vetor|icon|icone)\b/
const noImage = /\b(sem (?:imagem|foto|fotografia)|apenas texto|somente texto|no (?:image|photo)|text only)\b/
const translations: Record<string, string> = {
  arquitetura: 'architecture', fachada: 'facade', fachadas: 'facades', cidade: 'city', urbano: 'urban',
  ruas: 'streets', rua: 'street', tipografia: 'typography', impressao: 'printing', grafica: 'printing',
  cafe: 'coffee', xicara: 'cup', gato: 'cat', gatos: 'cats', bicicleta: 'bicycle', bicicletas: 'bicycles',
  biblioteca: 'library', livros: 'books', museu: 'museum', pessoas: 'people', jardim: 'garden',
  fotografia: 'photography', escritorio: 'office', madeira: 'wood', edificios: 'buildings', edificio: 'building',
  estacao: 'station', trem: 'train', ponte: 'bridge', feira: 'market', manifestacao: 'protest',
  natal: 'christmas', filme: 'film', filmes: 'films', animacao: 'animation', desfile: 'parade', bonecos: 'puppets',
}
const tokens = (value = '') => [...new Set((normalize(value.slice(0, 3000)).match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter(word => word.length <= 28 && !generic.has(word)))]

// Keep editorial associations explicit so a recognizable setting or technique can support an abstract headline.
const editorialContexts = [
  { cue: /\b(?:macy'?s?\b.{0,55}\b(?:desfile|parade)|(?:desfile|parade)\b.{0,55}\bmacy'?s?\b)/,
    query: 'macys thanksgiving day parade', evidence: [/\bmacy'?s\b/, /\bthanksgiving\b/, /\bparade\b/] },
  { cue: /\b(?:stop[ -]motion|animacao (?:artesanal|quadro a quadro)|animacao (?:com |de )?(?:bonecos|marionetes))\b/,
    query: 'stop motion', evidence: [/\bstop[ -]motion\b/, /\b(?:animat\w*|puppet\w*|bonecos|trickfilm)\b/] },
  { cue: /\b(?:(?:fabricacao|construcao|feitura|oficina) (?:de |dos )?(?:bonecos|marionetes)|puppet making)\b/,
    query: 'puppet making', evidence: [/\bpuppet\w*\b/, /\b(?:making|workshop|craft\w*|building)\b/] },
  { cue: /\b(?:mascotes? publicitari\w*|mascotes? de (?:marcas?|campanhas?)|(?:personagens|rostos) dos comerciais|advertising mascots?)\b/,
    query: 'advertising mascot', evidence: [/\bmascot\w*\b/, /\b(?:advertis\w*|brand\w*|commercial\w*)\b/] },
]

type SearchStage = { strategy: VisualMatch['strategy']; query: string; evidence?: readonly RegExp[] }

export function visualQueries(intent: VisualIntent) {
  const brief = normalize(intent.imageBrief ?? '')
  if (noImage.test(brief) || (!intent.imageBrief?.trim() && /^(cta|comparison|highlight)$/.test(intent.role ?? ''))) return
  const concreteBrief = conceptual.test(brief) ? [] : tokens(intent.imageBrief)
  const subject = tokens([intent.title, intent.subtitle].filter(Boolean).join(' ')).filter(word => !conceptual.test(word))
  const context = tokens([intent.body, intent.cta, intent.campaign].filter(Boolean).join(' ')).filter(word => !conceptual.test(word))
  const terms = [...new Set([...concreteBrief.slice(0, 5), ...subject.slice(0, 5), ...context.slice(0, 4)])]
  if (!terms.length || (!concreteBrief.length && !subject.length)) return
  const subjectTerms = [...new Set([...concreteBrief, ...subject])]
  const main = (concreteBrief.length >= 2 ? concreteBrief : subjectTerms.length >= 2 ? subjectTerms :
    [...new Set([...subjectTerms, ...context.slice(0, 2)])]).slice(0, 4)
  const translated = main.map(word => translations[word] ?? word)
  const expanded = translated.join(' ') !== main.join(' ') ? translated : [...new Set([...main.slice(0, 3), ...context])].slice(0, 5)
  const editorial = [...new Set([...main, ...subject, ...context.filter(word => translations[word])])].slice(0, 4)
  const slideContext = normalize([intent.imageBrief, intent.title, intent.subtitle, intent.body].filter(Boolean).join(' ').slice(0, 6000)).replace(/’/g, "'")
  const contextual = editorialContexts.filter(item => item.cue.test(slideContext)).slice(0, 2)
  const stages: SearchStage[] = [
    { strategy: 'documental', query: main.join(' ') },
    { strategy: 'documental-expandida', query: expanded.join(' ') },
    ...(contextual.length ? contextual.map(({ query, evidence }): SearchStage => ({ strategy: 'editorial', query, evidence })) :
      [{ strategy: 'editorial' as const, query: [...editorial, 'photograph'].join(' ') }]),
  ]
  return {
    terms, primary: main, ratio: intent.ratio ?? 1,
    stages,
  }
}
export type VisualQuery = NonNullable<ReturnType<typeof visualQueries>>
const stock = /\b(stock photo|stock photography|posed|staged|studio portrait|studio shot|isolated|white background|foto de banco|fundo branco)\b/
const documentary = /\b(documentary|documental|photojournal\w*|reportagem|arquivo|archive|historical|historico|historic|press photo|fotografia de imprensa|on location)\b/

export function rankPhotographs(results: ImageResult[], query: VisualQuery, strategy: VisualMatch['strategy'], used: ReadonlySet<string>,
  context?: SearchStage) {
  return results.flatMap(result => {
    const metadata = normalize([result.title, result.description, ...result.tags?.map(tag => tag.name) ?? []].filter(Boolean).join(' ')).replace(/[_-]/g, ' ').replace(/’/g, "'")
    const credit = toCredit(result)
    const license = licenseTerms(credit)
    const url = automaticOriginal(result)
    if (result.category !== 'photograph' || result.mature || conceptual.test(metadata) || !url || !credit.sourcePage ||
        !license.valid || !license.commercial || license.noDerivatives || (license.attribution && !credit.creator && !credit.attribution) ||
        used.has(result.id) || used.has(url.origin + url.pathname) || Math.min(result.width ?? 0, result.height ?? 0) < 480) return []
    const words = new Set(tokens(metadata))
    const overlaps = (terms: string[]) => terms.filter(word => words.has(word) || words.has(translations[word]))
    const anchor = overlaps(query.primary)
    const matches = overlaps(query.terms)
    if (context?.evidence ? !context.evidence.every(pattern => pattern.test(metadata)) :
      !anchor.length || (query.primary.length > 2 && matches.length < 2) ||
        (strategy !== 'editorial' && query.primary.length > 2 && anchor.length < 2)) return []
    const fromCommons = url.hostname === 'upload.wikimedia.org'
    const evidence = documentary.test(metadata) || anchor.length >= 2 && /\b(?:18|19|20)\d{2}\b/.test(normalize(result.title ?? ''))
    const factual = (evidence || fromCommons && anchor.length >= 2) && !stock.test(metadata)
    if (strategy !== 'editorial' && !factual) return []
    const ratio = result.width! / result.height!
    const fit = Math.min(ratio / query.ratio, query.ratio / ratio)
    const score = anchor.length * 6 + matches.length * 2 + (evidence ? 4 : 0) + (fromCommons ? 2 : 0) +
      2 * fit + Math.min(2, Math.min(result.width!, result.height!) / 720) - (used.has('autor:' + normalize(result.creator ?? '')) ? 2 : 0)
    const title = 'titulo:' + normalize(result.title ?? '').replace(/[_-]/g, ' ')
    if (used.has(title)) return []
    return [{ result, score, keys: [result.id, url.origin + url.pathname, title], matches }]
  }).sort((a, b) => b.score - a.score || a.result.id.localeCompare(b.result.id))
}

export async function findAutomaticImage(query: VisualQuery, signal: AbortSignal, used: ReadonlySet<string>,
  stage: (status: VisualStatus) => void) {
  const searched = new Set<string>()
  const tried = new Set<string>()
  let searchError: unknown
  for (const step of query.stages) {
    const { strategy, query: term, evidence } = step
    if (searched.has(term)) continue
    searched.add(term)
    if (strategy === 'editorial') stage('editorial')
    let results: ImageResult[]
    try {
      ({ results } = await searchImages({ query: term, photographs: true, page: 1, license: '', commercial: true, ratio: '', source: '' }, signal))
    } catch (error) {
      signal.throwIfAborted()
      if (!query.stages.some(item => item.evidence)) throw error
      searchError = error
      continue
    }
    for (const candidate of rankPhotographs(results, query, strategy, used, evidence ? step : undefined).slice(0, 4)) {
      if (tried.has(candidate.result.id)) continue
      tried.add(candidate.result.id)
      try {
        const file = await fetchOriginal(candidate.result, signal)
        const image = await readImage(file)
        try {
          signal.throwIfAborted()
          if (Math.min(image.width, image.height) < 480 || candidate.keys.some(key => used.has(key))) continue
          const scale = 64 / Math.max(image.width, image.height)
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))
          const context = canvas.getContext('2d')
          context?.drawImage(image.getElement(), 0, 0, canvas.width, canvas.height)
          const data = context?.getImageData(0, 0, canvas.width, canvas.height)
          const fingerprint = data && visualFingerprint(data)
          if (fingerprint && similarImage(fingerprint, used)) continue
          image.set({ imageCredit: toCredit(candidate.result), semantic: 'image', originX: 'left', originY: 'top' })
          const match: VisualMatch = { strategy, fingerprint, reason: evidence
            ? `Fotografia de apoio para o contexto pesquisado (${term}). Confira na fonte a cena e a data do registro.` : strategy === 'editorial'
            ? `Apoio fotográfico após baixa aderência documental. Termos em comum: ${candidate.matches.join(', ')}.`
            : `Indícios documentais no acervo ou nos metadados. Termos em comum: ${candidate.matches.join(', ')}.` }
          return { file, id: candidate.result.id, name: candidate.result.title || 'Fotografia',
            keys: [...candidate.keys, ...(fingerprint ? ['foto:' + fingerprint] : [])],
            creator: candidate.result.creator, object: image.toObject() as unknown as Record<string, unknown>, match,
            focalPoint: data && contrastFocalPoint(data.data, canvas.width, canvas.height) }
        } finally { image.dispose() }
      } catch { signal.throwIfAborted() }
    }
  }
  if (searchError) throw searchError
}
export type AutomaticImage = NonNullable<Awaited<ReturnType<typeof findAutomaticImage>>>

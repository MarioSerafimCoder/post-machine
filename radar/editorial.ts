import { editorialCategories } from '../src/features/radar/categories.ts'
import { normalize, type Article, type sourceSchema } from '../src/features/radar/contract.ts'
import type { z } from 'zod'

type Source = z.infer<typeof sourceSchema>
type Category = typeof editorialCategories[number]
type Ranked = { article: Article; score: number }

const terms = [
  'branding|rebranding|rebrand|visual identity|brand identity|brand design|brand strategy|brand refresh|brand system|identidade visual|identidade de marca|estratégia de marca|embalagem|packaging|logotipo|logomarca|logo redesign|new logo|building brands|brand repositioning|reposicionamento de marca',
  'graphic design|graphic designer|graphic designers|design gráfico|designer gráfico|typography|tipografia|typeface|type design|lettering|type foundry|poster design|cartaz|book design|editorial design|design editorial|font design|print design',
  'publicidade|publicitária|publicitário|campanha publicitária|campanha criativa|campanha de marca|agência de publicidade|agência criativa|advertising|advertising campaign|ad campaign|creative campaign|brand campaign|creative agency|ad agency|creative brief|ad placement|media buying|branded entertainment|filme publicitário|filme de natal|filme da campanha|copywriting|branded content|commercial spot|creative advertising|super bowl ads|out of home|mídia exterior',
  'art direction|direção de arte|art director|diretor de arte|diretora de arte|visual storytelling|narrativa visual|illustration|illustrator|ilustração|ilustrador|photography|photographs|fotografia|motion graphics|motion design|production design|design de produção|set design|cenografia|cinematography|visual effects|vfx|costume design|figurino|animação|animation|creative process in film|instalação artística|art installation|immersive installation|instalação imersiva|exhibition design|design expositivo|wayfinding|design de sinalização|public art|arte pública',
  'ux|ui|ux design|ui design|ux ui|user experience|experiência do usuário|interface design|design de interface|design digital|web design|website design|interaction design|design system|design systems|sistema de design|design de interação|product designer|acessibilidade digital|digital accessibility',
  'creative tools|ferramentas criativas|generative design|generative art|arte generativa|ai art|ai image|image generation|geração de imagens|gerador de imagens|creative ai|ia criativa|photoshop|lightroom|illustrator cc|figma|midjourney|adobe firefly|after effects|procreate|davinci resolve|blender 3d',
  'creative industry|creative industries|design industry|creative economy|mercado criativo|economia criativa|indústria criativa|design studio|branding studio|brand studio|estúdio de design|estúdios de design|estúdio criativo|agências criativas|design festival|semana do design|design awards|creative awards|cannes lions|prêmio de design|creative freelance|creative jobs|direitos autorais para artistas',
].map(group => group.split('|').map(phrase))

const priorities = [3, 3, 3, 0, 0, 0, 0]
const aliases: Record<string, Category> = {
  'Design e criatividade': editorialCategories[1],
  'Marketing e publicidade': editorialCategories[2],
}
const genericCommerce = / (black friday deals|cyber monday deals|best laptop deals|amazon deal|cashback|cupom de desconto|is on sale|half price|cheapest ever|guest posts|cassino online) /
const generalBrief = / (dies aged|has died|morre aos|obituary|daily cable news ratings|contract extension) /

function phrase(value: string) {
  return ' ' + normalize(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' '
}

function categoryHint(value: string) {
  return editorialCategories.find(category => category === value) ?? aliases[value]
}

export function classifyArticle(article: Article, source: Source): Ranked | undefined {
  const title = phrase(article.title)
  const summary = phrase(article.summary ?? '')
  const tags = phrase(article.feedTags?.join(' ') ?? '')
  const hint = categoryHint(source.category)
  const previousCategory = article.editorial || article.category === source.category ? undefined : categoryHint(article.category)
  const suppliedTag = article.feedTags?.some(tag => source.editorialTags.some(approved => phrase(tag) === phrase(approved)))
  const matches = terms.map((group, index) => {
    const count = (field: string) => Math.min(2, group.filter(term => field.includes(term)).length)
    const inTitle = count(title)
    const evidence = 8 * inTitle + 4 * count(summary) + 4 * count(tags)
    const category = editorialCategories[index]
    const tagged = hint === category && suppliedTag ? 5 : 0
    return { category, evidence: evidence + tagged, inTitle, score: evidence + tagged + Number(hint === category) * 2 + Number(previousCategory === category) + priorities[index] }
  })
  const match = matches.filter(item => item.evidence > 0).sort((a, b) => b.score - a.score)[0]
  if ((genericCommerce.test(title) || generalBrief.test(title)) && !match?.inTitle) return
  // Generalist sources need article evidence. A trend term alone cannot admit an item.
  const category = match?.category ?? (source.editorialProfile === 'specialist' ? hint : undefined)
  if (!category) return
  const scope = source.editorialProfile === 'adjacent' ? 'adjacent' : 'direct'
  return { article: { ...article, category, editorial: { category, scope } }, score: match?.score ?? 2 + priorities[editorialCategories.indexOf(category)] }
}

export function orderEdition(ranked: Ranked[]): Article[] {
  const sort = (a: Ranked, b: Ranked) => {
    const day = (item: Article) => (item.publishedAt ?? item.collectedAt).slice(0, 10)
    return day(b.article).localeCompare(day(a.article)) || b.score - a.score ||
      (b.article.publishedAt ?? b.article.collectedAt).localeCompare(a.article.publishedAt ?? a.article.collectedAt) ||
      a.article.id.localeCompare(b.article.id)
  }
  const direct = ranked.filter(item => item.article.editorial?.scope === 'direct').sort(sort)
  const adjacent = ranked.filter(item => item.article.editorial?.scope === 'adjacent').sort(sort)
  const result: Article[] = []
  const recent: string[] = []
  const publisher = (article: Article) => normalize(article.source).replace(/[^\p{L}\p{N}]+/gu, '')
  function take(queue: Ranked[]) {
    if (!queue.length) return
    // Diversify within a three-day band so one source cannot monopolize a row of cards.
    const cutoff = (queue[0].article.publishedAt ?? queue[0].article.collectedAt).slice(0, 10)
    const index = queue.findIndex(({ article }) => Date.parse(cutoff) - Date.parse((article.publishedAt ?? article.collectedAt).slice(0, 10)) <= 3 * 86400000 && !recent.includes(publisher(article)))
    const [{ article }] = queue.splice(Math.max(0, index), 1)
    result.push(article)
    recent.push(publisher(article))
    if (recent.length > 3) recent.shift()
  }
  const adjacentLimit = direct.length >= 4 ? Math.floor(direct.length / 4) : adjacent.length
  let adjacentUsed = 0
  while (result.length < 600 && (direct.length || (adjacent.length && adjacentUsed < adjacentLimit))) {
    if (adjacent.length && adjacentUsed < adjacentLimit && (!direct.length || result.length % 5 === 4)) {
      take(adjacent)
      adjacentUsed++
    } else take(direct)
  }
  return result
}

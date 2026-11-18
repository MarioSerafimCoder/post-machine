import { slideCount, type Briefing, type Draft } from '../campaigns/contract'
import { analyzeHeadline, characterCount } from '../headlines/analysis'
import { campaignHeadlineContext } from '../headlines/context'
import { normalize } from '../radar/contract'
import { knowledge } from './knowledge'
import type { Insight, Preference } from './types'

export type Recommendation = Insight & {
  instruction?: string
  patch?: Partial<Pick<Briefing, 'format' | 'approach'>>
  preference?: Preference
}

export function editorialContext(draft: Draft) {
  const articles = draft.opportunity?.articles ?? (draft.article ? [draft.article] : [])
  return {
    ...draft.briefing,
    articles,
    relatedSources: new Set(articles.map(article => new URL(article.canonicalUrl).hostname.replace(/^www\./, ''))).size,
    metadata: articles.some(article => article.summary?.trim()) ? 'título e resumo disponíveis' : 'apenas título e metadados disponíveis',
    access: draft.briefing.sourceAccess ?? 'metadata',
    content: draft.content,
    reference: draft.creativeOrigin,
  }
}

const channelNotes: Record<NonNullable<Briefing['channel']>, string> = {
  Instagram: 'Se usar uma sequência, dê a cada peça uma função e confira recorte e leitura no destino.',
  LinkedIn: 'Explicite por que o assunto importa para o trabalho do público. Se a entrega for um documento, trate sua montagem e validação como etapa separada.',
  Threads: 'Abra uma conversa com uma observação concreta e organize os desdobramentos como respostas ou sequência textual.',
  Pinterest: 'Use um título descritivo alinhado ao conteúdo e à intenção de busca. Planeje cada Pin como uma peça autônoma.',
  X: 'Concentre o ponto verificável na abertura. Separe contexto adicional em uma sequência textual se for preciso.',
  Facebook: 'Dê contexto suficiente para a publicação fazer sentido fora da sequência e relacione a imagem à mensagem.',
}

export function recommend(draft: Draft, score: (preference: Preference) => number = () => 0): Recommendation[] {
  const context = editorialContext(draft)
  const recommendations: Recommendation[] = []
  const add = (ruleId: string, title: string, detail: string, assessment: Insight['assessment'], fields?: Partial<Recommendation>) =>
    recommendations.push({ id: ruleId, ruleId, title, detail, assessment, ...fields })

  if (context.sourceConflict) add('SRC-005', 'As fontes divergem', 'Registre o que cada fonte sustenta, com seu trecho e contexto. Mantenha a divergência explícita enquanto ela não for resolvida.', 'needs_review')
  if (context.access === 'unavailable' || (context.articles.length && context.access === 'metadata')) {
    const access = context.access === 'unavailable' ? 'A fonte foi marcada como inacessível' : 'A íntegra ainda não foi confirmada'
    add('SRC-002', access, `${context.metadata}. Restrinja alegações ao material verificável e mantenha lacunas para revisão humana.`, 'insufficient_data')
  } else if (!context.articles.length && !context.content?.sources.length && !context.reference) {
    add('SRC-001', 'Confira se a pauta precisa de fontes', 'Uma opinião identificada pode partir do seu repertório. Vincule uma fonte e um trecho a cada alegação verificável antes de publicar.', 'insufficient_data')
  }
  if (!context.audience.trim()) add('PRF-002', 'Defina quem precisa desta pauta', 'Indique o que a pessoa já sabe e qual decisão ou aprendizado o conteúdo deve facilitar.', 'insufficient_data',
    { instruction: 'Considere a lacuna de público e escreva sem assumir familiaridade com o assunto.' })
  if (context.relatedSources > 1 && !context.sourceConflict) {
    const contextualize = score('explanation') > score('comparison')
    const approach = contextualize ? 'Contextualização' : 'Comparação'
    add('SRC-005', contextualize ? 'Contextualize as fontes antes de comparar' : 'Compare os recortes das fontes',
      `A oportunidade reúne ${context.relatedSources} domínios. Compare o que cada um relata e verifique a origem de informações repetidas.` +
      (contextualize ? ' O histórico deste perfil favorece uma abertura contextual.' : ''), 'heuristic', {
      id: 'comparar-fontes', preference: contextualize ? 'explanation' : 'comparison',
      patch: context.approach !== approach ? { approach } : undefined,
      alternative: contextualize ? 'Use comparação quando as fontes divergirem em um ponto específico e verificável.'
        : 'Use contextualização quando a comparação não acrescentar uma diferença verificável.',
      instruction: 'Atribua cada ponto à fonte correspondente e explicite divergências comprovadas.',
    })
  }
  if (context.reference) add('TXT-001', 'Adapte o mecanismo da referência', 'O formato cadastrado serve de referência criativa. Acrescente exemplos e material próprios à abordagem escolhida.', 'heuristic',
    { instruction: 'Use exemplos originais e concretos. Garanta que as observações cadastradas permaneçam identificadas como leitura editorial.' })

  const sequential = Boolean((context.content?.slides.length ?? 0) > 1 || ['Comparação', 'Storytelling', 'Lista'].includes(context.approach) ||
    context.relatedSources > 1 || context.objective === 'Educar')
  const conciseChannel = context.channel === 'Pinterest'
  const favorPost = conciseChannel || (!sequential && score('post') > score('carousel')) ||
    (!sequential && !(['Contextualização', 'Análise crítica'].includes(context.approach) || context.format === 'carousel' && score('carousel') > score('post')))
  const preferred = favorPost ? 'post' : 'carousel'
  const reasons = conciseChannel ? 'O registro do pacote descreve o Pin orgânico como uma peça de imagem autônoma.'
    : sequential ? 'A pauta tem etapas, recortes ou exemplos que podem ser desenvolvidos em uma sequência.'
      : 'Uma ideia central pode caber em uma peça. Use uma sequência se o contexto exigir etapas distintas.'
  const memory = !sequential && !conciseChannel && score('post') !== score('carousel')
    ? ' O histórico deste perfil pesa quando as duas estruturas são plausíveis.' : ''
  add('VIS-004', favorPost ? 'Considere um post único' : 'Considere um carrossel', reasons + memory, 'heuristic', {
    patch: context.format === preferred || context.content ? undefined : { format: preferred }, preference: preferred,
    alternative: favorPost ? 'Carrossel, se houver etapas que mereçam peças independentes.' : 'Post único, se um exemplo e sua conclusão couberem juntos.',
    instruction: favorPost ? 'Escolha um exemplo concreto para sustentar a ideia central.' : 'Dê continuidade aos exemplos e elimine repetições entre peças.',
  })

  const questions = score('headline-question') > score('headline-declarative')
  add('TTL-002', 'Escolha a abertura pelo recorte', questions
    ? 'O perfil tem mais escolhas recentes por perguntas. Teste uma pergunta somente se a peça oferecer uma resposta concreta.'
    : 'Uma abertura declarativa deixa a ideia explícita. Uma pergunta pode servir se a peça oferecer uma resposta concreta.', 'experimental',
    { alternative: 'Compare uma versão declarativa e uma pergunta com o mesmo conteúdo e objetivo.' })
  return recommendations
}

const ctaInstructions: Record<Briefing['objective'], string> = {
  Informar: 'ofereça a fonte ou o próximo contexto útil quando fizer sentido',
  Educar: 'proponha aplicar ou conferir um exemplo quando houver utilidade',
  'Gerar engajamento': 'convide a responder uma pergunta específica do material, evitando pedidos artificiais de interação',
  'Provocar reflexão': 'formule uma pergunta aberta ligada à ideia central',
  'Apresentar uma opinião': 'identifique o ponto de vista e convide a comparar argumentos',
  Converter: 'proponha uma ação realizável e indique o que a pessoa encontrará depois',
}

export function briefingInstructions(draft: Draft, recommendations: Recommendation[]) {
  const context = editorialContext(draft)
  const count = slideCount(draft.briefing)
  const structure = count === 1 ? 'Peça 1: apresente o assunto, desenvolva o ponto central e conclua no mesmo quadro.'
    : Array.from({ length: count }, (_, index) => index === 0
      ? 'Peça 1: delimite o assunto e a promessa.'
      : index === count - 1 ? `Peça ${count}: sintetize o aprendizado e faça a chamada apenas se couber no objetivo.`
        : `Peça ${index + 1}: avance um ponto distinto da abordagem ${context.approach.toLowerCase()}.`).join(' ')
  const limits = context.sourceConflict ? 'O editor indicou divergência. Atribua as versões e deixe o conflito explícito.'
    : context.access === 'unavailable' ? 'Acesso à fonte marcado como indisponível. Não invente detalhes que dependam da íntegra.'
      : context.articles.length && context.access === 'metadata' ? `Acesso no Post Machine: ${context.metadata}. Confira a íntegra antes de atribuir achados.` : ''
  const approved = recommendations.flatMap(item => item.instruction && context.acceptedRules?.includes(item.ruleId ?? '') &&
    !item.patch?.format ? [item.instruction] : [])
  const channel = context.channel ? `Canal de destino: ${context.channel}. ${channelNotes[context.channel]} Confira os limites atuais do fluxo de publicação.` : ''
  return [...new Set([
    `Estrutura do formato escolhido: ${structure}`,
    `CTA para ${context.objective.toLowerCase()}: ${ctaInstructions[context.objective]}.`,
    'Use substantivos e exemplos concretos. Faça o título cumprir a promessa, varie a estrutura onde ajudar e separe associação de causalidade.',
    'Na direção de arte, crie hierarquia entre título e exemplos, preserve a leitura sobre imagens e sugira descrição para imagens informativas.',
    limits, channel, ...approved,
  ].filter(Boolean))].slice(0, 12)
}

const comparisonKey = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function reviewEditorial(draft: Draft): Insight[] {
  const content = draft.content
  if (!content) return []
  const findings: Insight[] = []
  const note = (id: string, ruleId: string, title: string, detail: string, assessment: Insight['assessment']) =>
    findings.push({ id, ruleId, title, detail, assessment })
  if (content.campaign.format !== draft.briefing.format || content.slides.length !== slideCount(draft.briefing)) {
    note('format', 'VIS-004', 'Formato ou quantidade diverge do briefing', `O conteúdo tem ${content.slides.length} peça(s). O briefing prevê ${slideCount(draft.briefing)}. Confira também os dois campos de formato.`, 'verified')
  }
  if (!content.campaign.title.trim()) note('missing-title', 'TTL-001', 'Falta o nome da campanha', 'Preencha o nome na revisão editorial.', 'verified')
  if (draft.briefing.objective === 'Converter' && !content.campaign.cta.trim()) {
    note('missing-cta', 'PRF-002', 'A campanha de conversão está sem CTA', 'Revise qual ação é viável e o que o público encontra depois.', 'heuristic')
  }
  if (content.campaign.objective.trim() && comparisonKey(content.campaign.objective) !== comparisonKey(draft.briefing.objective)) {
    note('objective', 'PRF-002', 'Objetivo importado com redação diferente', 'Confirme se o texto importado preserva a intenção do briefing.', 'needs_review')
  }
  const present = new Set(content.sources.map(source => source.url))
  const { articles, access, sourceConflict } = editorialContext(draft)
  if (!present.size && draft.briefing.objective !== 'Apresentar uma opinião') {
    note('no-sources', 'SRC-001', 'Nenhuma fonte declarada', 'Se a peça apresenta fatos verificáveis, confira o suporte e registre as fontes.', 'needs_review')
  } else if (articles.some(article => !present.has(article.url) && !present.has(article.canonicalUrl))) {
    note('origin-missing', 'SRC-001', 'Uma referência de origem ficou fora', 'Confirme se a omissão é intencional e se o conteúdo continua sustentado.', 'needs_review')
  }
  if (access === 'unavailable' || (articles.length && access === 'metadata')) {
    note('access', 'SRC-002', 'Acesso à fonte exige revisão', 'Valide as alegações no material efetivamente consultado antes de aprovar.', 'needs_review')
  }
  if (sourceConflict) note('conflict', 'SRC-005', 'Divergência registrada', 'Atribua as versões e preserve a incerteza enquanto as fontes não forem conciliadas.', 'needs_review')

  const context = campaignHeadlineContext(draft)
  const titles = new Set<string>()
  const cta = comparisonKey(content.campaign.cta)
  let ctaOccurrences = 0
  for (const slide of content.slides) {
    const key = comparisonKey(slide.title)
    if (!key) note(`empty-${slide.order}`, 'TTL-001', `Peça ${slide.order} sem título`, 'Confirme se a ausência é intencional ou inclua um título que indique o assunto.', 'verified')
    else if (titles.has(key)) note(`repeat-${slide.order}`, 'VIS-004', `Título repetido na peça ${slide.order}`, 'Confira se a repetição ajuda a sequência ou se esta peça precisa de um recorte próprio.', 'verified')
    if (key) titles.add(key)
    if (cta && (key === cta || comparisonKey(slide.body).includes(cta))) ctaOccurrences++
    const diagnosis = analyzeHeadline(slide.title, slide.headlines ?? { maxChars: 0, maxWords: 0 }, context)
    if (diagnosis.heuristic.length) note(`headline-${slide.order}`, 'TTL-003', `Revise o título da peça ${slide.order}`, diagnosis.heuristic.join(' '), 'heuristic')
  }
  if (ctaOccurrences > 1) note('repeat-cta', 'VIS-004', 'Chamada repetida na sequência', `O CTA aparece em ${ctaOccurrences} peças. Confira se há motivo para a repetição.`, 'verified')
  if (draft.briefing.channel === 'Pinterest') {
    const limit = knowledge.platforms.pinterest.verified_rules.find(rule => rule.key === 'pin_title_max_chars')?.value
    if (typeof limit === 'number' && characterCount(content.campaign.title) > limit) {
      note('pin-title', 'PLT-001', 'Título acima do limite registrado para Pin', `O pacote de ${knowledge.edition} registra ${limit} caracteres para o título do Pin orgânico. Confirme o campo e o limite no fluxo atual antes de publicar.`, 'needs_review')
    }
  }
  return findings
}

import { useEffect, useRef, type RefObject } from 'react'
import { Icon } from '../../components/Icon'
import { AssistantPreferences } from '../intelligence/AssistantPreferences'
import { recordEditorialFeedback, useEditorialMemory } from '../intelligence/feedback'
import { editorialCategories } from './categories'
import type { Article, Opportunity } from './contract'

const angles: Record<typeof editorialCategories[number], [string, string]> = {
  'Branding e identidade visual': ['Ajuda a observar como marcas expressam seu posicionamento.', 'Escolha uma decisão visual descrita na fonte e explique o que ela comunica.'],
  'Design gráfico e tipografia': ['Oferece uma referência para discutir escolhas de composição e leitura.', 'Destaque uma escolha gráfica citada na fonte e mostre como ela orienta o olhar.'],
  'Publicidade e criação': ['É um ponto de partida para discutir como uma ideia de campanha chega ao público.', 'Faça um post sobre a ideia central e o meio usado para colocá-la em circulação, se a fonte os descrever.'],
  'Direção de arte e imagem': ['Oferece repertório para discutir como escolhas visuais dão forma a um projeto.', 'Analise um recurso visual documentado na matéria, como luz, cor ou enquadramento.'],
  'Design digital e UX/UI': ['Abre espaço para discutir como decisões de produto afetam a experiência de uso.', 'Explique a mudança de interface relatada e proponha uma pergunta para avaliar seu efeito.'],
  'IA e ferramentas criativas': ['Pode ajudar a avaliar mudanças no trabalho de criação e no uso de ferramentas.', 'Mostre uma etapa do trabalho que a novidade pode afetar e indique o que ainda valeria testar.'],
  'Mercado criativo': ['Ajuda a acompanhar mudanças que podem afetar quem trabalha com criação.', 'Separe o anúncio confirmado de uma possível implicação para estúdios ou profissionais.'],
}
const suggestionId = 'radar:article'

function ArticleReading({ article, opportunity, onDismiss }: { article: Article; opportunity?: Opportunity; onDismiss: () => void }) {
  const memory = useEditorialMemory()
  const text = article.summary?.trim() ?? ''
  const sentences = text && Array.from(new Intl.Segmenter(article.language === 'en' ? 'en' : 'pt-BR', {
    granularity: 'sentence',
  }).segment(text)).slice(0, 3).map(part => part.segment).join('').trim()
  const category = editorialCategories.find(value => value === article.category)
  const angle = category && angles[category]
  const suggestion = text && (opportunity?.angle || angle?.[1])
  const dismissed = memory.history.some(entry => entry.scope === article.id && entry.id === suggestionId && entry.outcome === 'dismissed')
  return <>
    <p className="news-reading-title" title={article.title}>{article.title}</p>
    <p className="news-reading-basis">{text ? 'Análise baseada no resumo disponível' : 'A fonte forneceu apenas a manchete'} · {article.source}</p>
    <div className="news-reading-section">
      <h3>O que aconteceu?</h3>
      {sentences ? <p lang={article.language}>{sentences}{(sentences.length < text.length || text.length === 420) && !/[.!?…]$/.test(sentences) ? '…' : ''}</p>
        : <p>Sem um resumo, o Radar não consegue confirmar os detalhes da manchete. Consulte a notícia original.</p>}
    </div>
    {text && angle && <div className="news-reading-section">
      <h3>Por que isso importa?</h3>
      <p><strong>Leitura editorial.</strong> {angle[0]}</p>
    </div>}
    {suggestion && !dismissed && <div className="news-reading-section">
      <h3>Como aproveitar essa notícia?</h3>
      <p>{suggestion}</p>
      <button className="text-button" onClick={() => {
        onDismiss()
        recordEditorialFeedback({ scope: article.id, id: suggestionId, outcome: 'dismissed' })
      }}>Dispensar sugestão</button>
    </div>}
  </>
}

export function NewsAssistant({ selection, onOpen, onClose, article, opportunity, launcher, onCreate }: {
  selection?: string | null; onOpen: () => void; onClose: () => void; article?: Article; opportunity?: Opportunity
  launcher: RefObject<HTMLButtonElement | null>; onCreate: (article: Article) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const open = selection !== undefined
  useEffect(() => {
    if (selection !== undefined) heading.current?.focus()
  }, [selection])
  return <aside className="editorial-dock news-assistant" aria-label="Assistente Editorial" data-open={open}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.stopPropagation(); onClose() }
    }}>
    {!open && <button className="button button-outline news-assistant-launcher" ref={launcher} aria-expanded={false} onClick={onOpen}>
      <img src="/assistant/avatar.png" alt="" width="34" height="34" /> Assistente Editorial
    </button>}
    {open && <section className="editorial-popover news-assistant-panel" id="news-assistant-panel" aria-labelledby="news-assistant-heading" key={selection}>
      <header>
        <img src="/assistant/avatar.png" alt="" width="34" height="34" />
        <h2 id="news-assistant-heading" ref={heading} tabIndex={-1}>Assistente Editorial</h2>
        <button className="news-assistant-close" aria-label="Fechar assistente" onClick={onClose}><Icon name="close" /></button>
      </header>
      {article ? <>
        <ArticleReading article={article} opportunity={opportunity} onDismiss={() => heading.current?.focus()} />
        <div className="news-reading-actions">
          <button className="button button-dark news-create" onClick={() => onCreate(article)}>Criar post com esta notícia <Icon name="arrow" /></button>
          <a className="text-button" href={article.url} target="_blank" rel="noreferrer">Ler notícia original <Icon name="external" /></a>
        </div>
      </> : <p>Escolha <strong>Analisar notícia</strong> em um cartão para consultar o resumo e explorar uma abordagem para o post.</p>}
      <AssistantPreferences />
    </section>}
  </aside>
}

import { useState, type MouseEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { Article } from './contract'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' })

function NewsThumbnail({ article }: { article: Article }) {
  const [failed, setFailed] = useState(false)
  return <div className="news-thumbnail" aria-hidden="true">
    {article.imageUrl && !failed
      ? <img src={article.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailed(true)} onLoad={event => {
          if (event.currentTarget.naturalWidth < 100 || event.currentTarget.naturalHeight < 60) setFailed(true)
        }} />
      : <span>{article.source}</span>}
  </div>
}

export function NewsCard({ article, saved, canSave, selected, onSave, onCreate, onRead, reason, related = [], onReject }: {
  reason?: string; related?: Article[]; onReject?: () => void
  article: Article; saved: boolean; canSave: boolean; selected: boolean
  onSave: () => void; onCreate: () => void; onRead: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return <article className="news-card news-story" data-selected={selected || undefined}>
    <NewsThumbnail article={article} key={article.imageUrl} />
    <div className="news-story-body">
      <span className="badge">{article.category}</span>
      <h3><a href={article.url} target="_blank" rel="noreferrer" title={article.title}>{article.title}</a></h3>
      <p className="news-story-meta"><strong>{article.source}</strong><span aria-hidden="true">·</span>
        {article.publishedAt ? <time dateTime={article.publishedAt}>{dateFormat.format(new Date(article.publishedAt))}</time> : 'Sem data de publicação'}
        {article.editorial?.scope === 'adjacent' && <span>· Contexto criativo</span>}
      </p>
      {reason && <p className="muted">{reason}</p>}
      {related.length > 0 && <details><summary>Pautas relacionadas · {related.length}</summary><ul>{related.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.title} · {item.source}</a></li>)}</ul></details>}
      {article.summary && <p className="news-story-summary" lang={article.language}>{article.summary}</p>}
      {article.trend && <p className="news-trend"><a href="https://trends.google.com/trending?geo=BR" target="_blank" rel="noreferrer">Google Trends</a> · {article.trend}</p>}
    </div>
    <footer className="news-story-actions">
      <button type="button" className="button button-dark news-create" onClick={onCreate}>Criar carrossel <Icon name="arrow" /></button>
      <button type="button" className="button button-outline news-read" aria-label={`Analisar notícia: ${article.title}`}
        aria-expanded={selected} aria-controls={selected ? 'news-assistant-panel' : undefined} onClick={onRead}>
        <Icon name="spark" /> Analisar notícia
      </button>
      <button type="button" className="news-favorite" aria-label={`Favoritar: ${article.title}`} aria-pressed={saved}
        title={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} disabled={!canSave} onClick={onSave}>
        <Icon name="star" />
      </button>
      {onReject && <button type="button" className="button button-outline" onClick={onReject}>Menos como esta</button>}
    </footer>
  </article>
}

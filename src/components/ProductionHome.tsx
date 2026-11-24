import { useEffect, useRef, useState, type ReactNode } from 'react'
import { snapshotSchema, type Article, type Opportunity } from '../features/radar/contract'
import { productionOrigins, type ContentOrigin } from './productionOrigins'

export function ProductionHome({ choose, startArticle, children }: {
  choose: (origin: ContentOrigin) => void
  startArticle: (article: Article) => Promise<void>
  children: ReactNode
}) {
  const [edition, setEdition] = useState<Opportunity[] | null>()
  const [starting, setStarting] = useState<string>()
  const [failed, setFailed] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/radar.json', { cache: 'no-cache', signal: controller.signal }).then(response => {
      if (!response.ok) throw Error()
      return response.json()
    }).then(raw => {
      if (!controller.signal.aborted) setEdition(snapshotSchema.parse(raw).opportunities?.slice(0, 3) ?? [])
    }).catch(() => { if (!controller.signal.aborted) setEdition(null) })
    return () => controller.abort()
  }, [])
  async function start(article: Article) {
    if (pending.current) return
    pending.current = true
    setStarting(article.id)
    setFailed(false)
    try { await startArticle(article) }
    catch { setFailed(true) }
    finally { pending.current = false; setStarting(undefined) }
  }
  return <>
    <div className="production-grid" aria-label="Origens do carrossel" role="group">
      {productionOrigins.map(({ id, label, description }) => <button key={id} className="production-origin" onClick={() => choose(id)}>
        <strong>{label}</strong><span>{description}</span>
      </button>)}
    </div>
    {children}
    <section className="production-section" aria-labelledby="production-opportunities">
      <header><h2 id="production-opportunities">Oportunidades para criar</h2><a className="text-button" href="#/radar">Ver Radar</a></header>
      {edition === undefined && <p role="status">Carregando oportunidades…</p>}
      {edition === null && <p role="status">A edição do Radar está indisponível.</p>}
      {edition?.length === 0 && <p>Esta edição ainda não tem oportunidades.</p>}
      {failed && <p role="alert">Não foi possível iniciar a produção. Tente novamente.</p>}
      <div className="production-grid">{edition?.map(({ articles, type, angle }, index) => {
        const article = articles[0]
        return <article className="production-opportunity" key={article.id + index}>
          {article.imageUrl && <img src={article.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}
          <small>{type} · {article.source}</small>
          <h3>{article.title}</h3><p>{angle}</p>
          <button className="button button-outline" disabled={!!starting} aria-label={`Criar a partir de ${article.title}`}
            onClick={() => void start(article)}>{starting === article.id ? 'Preparando…' : 'Criar a partir desta pauta'}</button>
        </article>
      })}</div>
    </section>
  </>
}

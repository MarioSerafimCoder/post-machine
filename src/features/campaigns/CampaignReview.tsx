import { useId, useState } from 'react'
import { HeadlinePanel } from '../headlines/HeadlinePanel'
import { campaignHeadlineContext } from '../headlines/context'
import { campaignScope } from '../intelligence/feedback'
import { formats, maxSlides, roles, type Slide, type Content, type Draft } from './contract'
const blankSlide: Slide = { order: 1, role: 'content', title: '', body: '', imageBrief: '', layoutType: 'editorial' }
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
const publicationDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? dateOnly.format(new Date(value + 'T00:00:00.000Z')) : date.format(new Date(value))

export function Select<T extends string>({ label, value, options, change }: {
  label: string; value: T; options: Record<T, string>; change: (value: T) => void
}) {
  const id = useId()
  return <label htmlFor={id}><span id={id + '-label'}>{label}</span><select id={id} aria-labelledby={id + '-label'} value={value} onChange={event => change(event.target.value as T)}>
    {Object.keys(options).map(key => <option key={key} value={key}>{options[key as T]}</option>)}
  </select></label>
}

export function Review({ draft, active, content, update }: { draft: Draft; active: boolean; content: Content; update: (content: Content) => void }) {
  const [headlineIndex, setHeadlineIndex] = useState<number>()
  const { campaign, slides } = content
  const setSlides = (items: Slide[]) => update({ ...content, slides: items.map((item, index) => ({ ...item, id: item.id ?? crypto.randomUUID(), order: index + 1 })) })
  const move = (index: number, direction: number) => {
    setHeadlineIndex(undefined)
    const next = [...slides]
    const [slide] = next.splice(index, 1)
    next.splice(index + direction, 0, slide)
    setSlides(next)
  }
  const slideField = (index: number, changes: Partial<Slide>) => setSlides(slides.map((item, position) => position === index ? { ...item, ...changes } : item))
  const limit = campaign.format === 'carousel' ? maxSlides : 1

  return <section className="campaign-panel" aria-labelledby="campaign-review-heading">
    <h3 id="campaign-review-heading" tabIndex={-1}>Revisão editorial</h3>
    <p className="muted">{formats[campaign.format]} · {slides.length} {slides.length === 1 ? 'peça' : 'peças'}. A arte pode ser criada no Studio.</p>
    <div className="campaign-fields">
      {([['title', 'Nome da campanha'], ['objective', 'Objetivo da campanha'], ['audience', 'Público da campanha'], ['tone', 'Tom da campanha']] as const)
        .map(([key, label]) => <label key={key}>{label}<input value={campaign[key]} maxLength={500} onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
      {([['caption', 'Legenda'], ['cta', 'Chamada para ação']] as const)
        .map(([key, label]) => <label className="campaign-wide" key={key}>{label}<textarea rows={3} value={campaign[key]} maxLength={8000}
          onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
    </div>
    <h4>Referências</h4>
    <ul className="campaign-sources">{content.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      {source.publishedAt && <time dateTime={source.publishedAt}> · {publicationDate(source.publishedAt)}</time>}</li>)}</ul>
    <ol className="campaign-slides">{slides.map((slide, index) => <li key={slide.id ?? slide.order}>
      <fieldset className="campaign-slide">
        <legend>Peça {slide.order} · {roles[slide.role]}</legend>
        <div className="campaign-fields">
          <Select label="Função" value={slide.role} options={roles} change={role => slideField(index, { role })} />
          <label>Layout previsto<input maxLength={500} value={slide.layoutType} onChange={event => slideField(index, { layoutType: event.target.value })} /></label>
          <label className="campaign-wide">Título<input maxLength={500} value={slide.title} onChange={event => slideField(index, { title: event.target.value })} /></label>
          <label className="campaign-wide">Corpo<textarea rows={3} maxLength={8000} value={slide.body} onChange={event => slideField(index, { body: event.target.value })} /></label>
          <label className="campaign-wide">Sugestão de imagem<textarea rows={2} maxLength={8000} value={slide.imageBrief} onChange={event => slideField(index, { imageBrief: event.target.value })} /></label>
        </div>
        <button type="button" className="button button-outline" aria-expanded={headlineIndex === index} onClick={() => setHeadlineIndex(value => value === index ? undefined : index)}>Melhorar headline</button>
        {headlineIndex === index && <HeadlinePanel title={slide.title} stored={slide.headlines} context={{ ...campaignHeadlineContext(draft), selectedSlide: index + 1 }}
          assistant={active ? { area: 'radar', scope: campaignScope(draft), id: `${draft.id}:${slide.order}` } : undefined}
          save={(headlines, text) => slideField(index, { headlines, title: text ?? slide.title })} />}
        <div className="campaign-actions">
          <button className="button button-outline" disabled={index === 0} onClick={() => move(index, -1)}>Mover para cima</button>
          <button className="button button-outline" disabled={index === slides.length - 1} onClick={() => move(index, 1)}>Mover para baixo</button>
          <button className="button button-outline" disabled={slides.length >= limit}
            onClick={() => { setHeadlineIndex(undefined); setSlides([...slides.slice(0, index + 1), { ...slide, id: crypto.randomUUID() }, ...slides.slice(index + 1)]) }}>Duplicar peça</button>
          <button className="button button-outline" disabled={slides.length === 1} onClick={() => { setHeadlineIndex(undefined); setSlides(slides.filter((_, position) => position !== index)) }}>Excluir peça</button>
        </div>
      </fieldset>
    </li>)}</ol>
    {campaign.format === 'carousel' && <button className="button button-outline" disabled={slides.length >= limit} onClick={() => setSlides([...slides, blankSlide])}>Adicionar peça</button>}
  </section>
}

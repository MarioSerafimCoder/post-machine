import { useEffect, useRef, useState } from 'react'
import { collections, collectionBrand, composeCollection, compositionNames, demoSlides, type Collection } from './collections'
import { renderScene } from './export'
import { loadFonts } from './fonts'
import { defaultBrand, dimensions, formatNames, type Format } from './model'

const thumbnails = new Map<string, Promise<Blob>>()
let queue: Promise<unknown> = Promise.resolve()
function thumbnail(style: Collection, index: number, format: Format) {
  const key = `v${style.version}:${style.id}:${format}:${index}`
  const cached = thumbnails.get(key)
  if (cached) return cached
  const task = queue.then(async () => {
    const brand = collectionBrand(style, defaultBrand)
    await loadFonts(brand)
    const { scene } = composeCollection(style, index, demoSlides[index], brand, format)
    const [width,height] = dimensions[format]
    const result = await renderScene(scene, width,height, { scale: index === 0 ? .34 : .42 })
    return result.blob
  })
  queue = task.catch(() => undefined)
  thumbnails.set(key,task)
  void task.catch(() => thumbnails.delete(key))
  if (thumbnails.size > 72) thumbnails.delete(thumbnails.keys().next().value!)
  return task
}

function Thumbnail({ style, index, format }: { style: Collection; index: number; format: Format }) {
  const container = useRef<HTMLDivElement>(null)
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let url = ''
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      void thumbnail(style,index,format).then(blob => {
        if (active) { url = URL.createObjectURL(blob); setSource(url) }
      }, () => { if (active) setFailed(true) })
    }, {rootMargin:'120px'})
    observer.observe(container.current!)
    return () => { active = false; observer.disconnect(); if (url) URL.revokeObjectURL(url) }
  }, [style,index,format])
  return <div className="collection-thumb" ref={container}>
    {source ? <img src={source} alt={`${compositionNames[index]} · ${style.name}`} /> :
      <span className="muted">{failed ? 'Prévia indisponível' : 'Carregando prévia…'}</span>}
  </div>
}

export function CollectionGallery({ selected, format, setFormat, use }: {
  selected?: string; format: Format; setFormat: (format: Format) => void; use: (style: Collection) => void
}) {
  const [excluded, setExcluded] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem('post-machine:excluded-collections') ?? '[]')
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
    } catch { return [] }
  })
  const [error, setError] = useState('')
  function exclude(style: Collection) {
    if (!window.confirm(`Excluir a coleção “${style.name}” desta biblioteca neste navegador?`)) return
    try {
      const next = [...excluded, style.id]
      localStorage.setItem('post-machine:excluded-collections', JSON.stringify(next))
      setExcluded(next)
      setError('')
    } catch { setError('Não foi possível salvar a exclusão da coleção. Tente novamente.') }
  }
  const [preview, setPreview] = useState<Collection>()
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  function visualize(style: Collection, control: HTMLButtonElement) {
    trigger.current = control
    setIndex(0)
    setPreview(style)
    dialog.current?.showModal()
  }
  return <section className="collection-gallery" aria-label="Coleções de templates">
    <label>Formato da coleção<select value={format} onChange={event => setFormat(event.target.value as Format)}>
      {Object.entries(formatNames).map(([key,name]) => <option key={key} value={key}>{name} · {dimensions[key as Format].join(' × ')}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    <div className="collection-grid">{collections.filter(style => !excluded.includes(style.id)).sort((a,b) => Number(!!b.premium) - Number(!!a.premium)).map(style => <article key={style.id} data-selected={style.id === selected}>
      <Thumbnail key={format} style={style} index={0} format={format} />
      <div className="collection-card-copy">
        <h3>{style.name}</h3>{style.premium && <small className="collection-premium">Coleção premium</small>}<p>{style.style}</p><small>{style.formats.map(value => formatNames[value]).join(' · ')}</small>
        <div className="collection-actions"><button className="button button-outline" onClick={event => visualize(style,event.currentTarget)}>Visualizar</button>
          <button className="button button-dark" onClick={() => use(style)}>{style.id === selected ? 'Selecionada' : 'Usar coleção'}</button>
          <button className="button button-delete-template" onClick={() => exclude(style)}>Excluir template</button></div>
      </div>
    </article>)}</div>
    <dialog ref={dialog} className="collection-dialog" aria-labelledby="collection-preview-title" onClose={() => {
      setPreview(undefined)
      trigger.current?.focus()
    }}>
      {preview && <><header><div><h3 id="collection-preview-title">{preview.name}</h3><p>{preview.style}</p></div>
        <button className="button button-outline" autoFocus onClick={() => dialog.current?.close()}>Fechar</button></header>
        <Thumbnail key={`${format}:${index}`} style={preview} index={index} format={format} />
        <nav className="collection-actions" aria-label="Composições da coleção">
          {compositionNames.map((name, i) => <button key={name} className="button button-outline" aria-pressed={i === index}
            onClick={() => setIndex(i)}>{name}</button>)}
        </nav>
        <div className="collection-actions">
          <label>Formato da prévia<select value={format} onChange={event => setFormat(event.target.value as Format)}>
            {preview.formats.map(value => <option key={value} value={value}>{formatNames[value]}</option>)}
          </select></label>
          <button className="button button-dark" onClick={() => { dialog.current?.close(); use(preview) }}>Usar coleção</button>
        </div>
      </>}
    </dialog>
  </section>
}

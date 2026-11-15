import { useEffect, useState } from 'react'
import { listUsedImages, readImageAsset, type UsedImage } from '../studio/storage'
import { creditText } from './credits'
import { licenseName } from './contract'
import type { InsertImage } from './ImageSearch'

function LocalPreview({ asset }: { asset: string }) {
  const [url, setUrl] = useState('')
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    let alive = true, url = ''
    void readImageAsset(asset).then(blob => {
      if (alive) { url = URL.createObjectURL(blob); setUrl(url) }
    }, () => { if (alive) setBroken(true) })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [asset])
  return url && !broken ? <img src={url} alt="Prévia local" loading="lazy" onError={() => setBroken(true)} />
    : <span className="image-placeholder">{broken ? 'Imagem indisponível' : 'Carregando prévia…'}</span>
}

export function ImageLibrary({ flush, insert }: { flush: () => Promise<void>; insert: InsertImage }) {
  const [items, setItems] = useState<UsedImage[]>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState(12)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let active = true
    void flush().then(listUsedImages).then(value => { if (active) setItems(value) }, cause => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [flush])
  async function reuse(item: UsedImage) {
    setPending(true); setError(''); setNotice('')
    try {
      const blob = await readImageAsset(item.asset)
      await insert(new File([blob], item.credit?.title || 'imagem-local', { type: blob.type }), item.credit)
      setNotice('Imagem reutilizada no Studio.')
    } catch (cause) { setError(String(cause)) }
    finally { setPending(false) }
  }
  return <section className="image-workspace" aria-label="Imagens utilizadas">
    <h3>Imagens utilizadas</h3>
    {!items && !error && <p role="status">Carregando imagens locais…</p>}
    {items?.length === 0 && <p>As imagens salvas em projetos locais aparecerão aqui.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="image-gallery">{items?.slice(0, limit).map(item => <article className="image-card" key={item.id}>
      <LocalPreview asset={item.asset} />
      <strong>{item.credit?.title || 'Imagem sem título'}</strong>
      <small>{item.credit?.source || item.credit?.catalogProvider || (item.credit ? 'Openverse' : 'Arquivo local')}</small>
      <small>{licenseName(item.credit?.license)}</small>
      <button disabled={pending} onClick={() => void reuse(item)}>Reutilizar imagem</button>
      {item.credit && <button onClick={() => {
        void navigator.clipboard.writeText(creditText(item.credit!)).then(() => setNotice('Créditos copiados.'), () => setError('Não foi possível copiar os créditos.'))
      }}>Copiar créditos</button>}
    </article>)}</div>
    {items && items.length > limit && <button onClick={() => setLimit(value => value + 12)}>Mostrar mais imagens</button>}
  </section>
}

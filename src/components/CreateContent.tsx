import { useEffect, useRef } from 'react'
import { productionOrigins, type ContentOrigin } from './productionOrigins'

export function CreateContent({ choose, close }: { choose: (origin: ContentOrigin) => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    dialog?.showModal()
    return () => { dialog?.close(); if (trigger instanceof HTMLElement) trigger.focus() }
  }, [])
  return <dialog className="roadmap-dialog create-content" ref={ref} aria-labelledby="create-content-heading" onCancel={close}>
    <h2 id="create-content-heading">Criar carrossel</h2>
    <p className="muted">Escolha por onde começar.</p>
    <div className="create-content-paths">
      {productionOrigins.map(({ id, label }) => <button key={id} className="button button-outline" onClick={() => choose(id)}>{label}</button>)}
    </div>
    <button className="button button-outline" onClick={close}>Cancelar</button>
  </dialog>
}

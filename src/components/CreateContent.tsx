import { useEffect, useRef } from 'react'

export type ContentOrigin = 'radar' | 'import' | 'blank'

export function CreateContent({ choose, close }: { choose: (origin: ContentOrigin) => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    dialog?.showModal()
    return () => { dialog?.close(); if (trigger instanceof HTMLElement) trigger.focus() }
  }, [])
  return <dialog className="roadmap-dialog create-content" ref={ref} aria-labelledby="create-content-heading" onCancel={close}>
    <h2 id="create-content-heading">Criar conteúdo</h2>
    <p className="muted">Escolha por onde começar.</p>
    <div className="create-content-paths">
      <button className="button button-outline" onClick={() => choose('radar')}>Usar notícia ou oportunidade do Radar</button>
      <button className="button button-outline" onClick={() => choose('import')}>Colar ou importar conteúdo pronto</button>
      <button className="button button-outline" onClick={() => choose('blank')}>Começar do zero</button>
    </div>
    <button className="button button-outline" onClick={close}>Cancelar</button>
  </dialog>
}

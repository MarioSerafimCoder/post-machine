import { useEffect, useRef } from 'react'
import type { ContentOrigin } from './productionOrigins'

export function CreateContent({ choose, close }: { choose: (origin: ContentOrigin, file?: File) => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const file = useRef<HTMLInputElement>(null)
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
      <button className="button button-dark" onClick={() => choose('import')}>Importar conteúdo</button>
      <button className="button button-outline" onClick={() => file.current?.click()}>Importar arquivo</button>
      <input ref={file} hidden type="file" aria-label="Arquivo para criar conteúdo"
        accept=".json,.md,.txt,application/json,text/markdown,text/plain" onChange={event => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected) choose('import', selected)
        }} />
      <button className="button button-outline" onClick={() => choose('blank')}>Criar manualmente</button>
    </div>
    <button className="button button-outline" onClick={close}>Cancelar</button>
  </dialog>
}

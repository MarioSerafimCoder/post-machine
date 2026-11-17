import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

const phases = [
  ['Radar','Notícias, oportunidades e criação de pautas'],
  ['Campanhas','Briefing, prompt para ChatGPT e importação de conteúdo'],
  ['Produção Expressa','Três propostas editáveis com 11 coleções'],
  ['Studio','Edição contextual, frames, imagens e marca'],
  ['Finalização','Auditoria, PNG, ZIP, legendas e créditos'],
]
export function Roadmap({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="roadmap-title" className="roadmap-dialog">
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">RECURSOS PUBLICADOS</p><h2 id="roadmap-title">Como o Post Machine funciona</h2></div><button className="icon-button" aria-label="Fechar roteiro" onClick={onClose}><Icon name="close" /></button></div>
    <p className="muted">Do Radar à exportação, este é o fluxo disponível hoje.</p>
    <ol className="phase-list">{phases.map(([name,info], index) => <li key={name}><span className="phase-index">{String(index+1).padStart(2,'0')}</span><span><strong>{name}</strong><br />{info}</span></li>)}</ol>
    <p className="small muted">O Radar tem coleta agendada. Campanhas, projetos e referências são salvos no navegador.</p>
    <button className="button button-dark" onClick={onClose}>Voltar</button>
  </dialog>
}

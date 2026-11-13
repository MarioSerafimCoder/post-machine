import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

const phases = ['Fundação e navegação', 'Radar funcional', 'Prompts e campanhas', 'Studio e templates', 'Auditoria de layout', 'Imagens e inteligência adicional', 'Refinamento e acessibilidade']
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
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">UM PASSO DE CADA VEZ</p><h2 id="roadmap-title">O que vem pela frente.</h2></div><button className="icon-button" aria-label="Fechar roteiro" onClick={onClose}><Icon name="close" /></button></div>
    <p className="muted">A base está em construção. Cada etapa só avança depois de ser verificada.</p>
    <ol className="phase-list">{phases.map((phase, index) => <li key={phase}><span className="phase-index">0{index}</span><span>{phase}</span><span className={`badge ${index === 0 ? 'badge-green' : ''}`}>{index === 0 ? 'Em validação' : 'Planejado'}</span></li>)}</ol>
    <p className="small muted">Fase 0: interface disponível; publicação protegida ainda depende da configuração do Cloudflare.</p>
    <button className="button button-dark" onClick={onClose}>Voltar ao espaço</button>
  </dialog>
}

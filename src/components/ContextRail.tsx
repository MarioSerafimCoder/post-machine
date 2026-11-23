import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ContextTool = { label: string; icon: IconName }

export function ContextRail({ label, tools, selected, choose, completed = [], disabled = false }: {
  label: string; tools: readonly ContextTool[]; selected: string | null; choose: (label: string) => void
  completed?: readonly string[]; disabled?: boolean
}) {
  return <nav className="context-rail" aria-label={label}>
    {tools.map(tool => <button key={tool.label} type="button" aria-label={tool.label} aria-pressed={selected === tool.label}
      disabled={disabled} data-complete={completed.includes(tool.label) || undefined}
      aria-description={completed.includes(tool.label) ? 'Etapa concluída' : undefined}
      title={tool.label} onClick={() => choose(tool.label)}>
      <Icon name={tool.icon} /><span>{tool.label}</span>
    </button>)}
  </nav>
}

export function ContextHeader({ title, close }: { title: string; close: () => void }) {
  return <header className="context-header"><strong>{title}</strong>
    <button type="button" className="icon-button" aria-label={`Recolher ${title}`} onClick={event => {
      const workspace = event.currentTarget.closest('.context-workspace')
      close()
      workspace?.querySelector<HTMLButtonElement>('.context-rail button[aria-pressed=true]')?.focus()
    }}><Icon name="close" /></button>
  </header>
}

export function ContextWorkspace({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return <div className="context-workspace">{rail}<div className="context-content">{children}</div></div>
}

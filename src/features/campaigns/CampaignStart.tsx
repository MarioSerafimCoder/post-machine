import { useState } from 'react'
export type CampaignStartMode = 'blank' | 'import' | 'radar'
export function CampaignStart({ choose }: { choose: (mode: CampaignStartMode) => void }) {
  const [open, setOpen] = useState(false)
  return <div className="campaign-actions"><button className="button button-dark" aria-expanded={open} onClick={() => setOpen(value => !value)}>Nova campanha</button>{open && <div role="group" aria-label="Origem da campanha">{([['blank', 'Começar do zero'], ['import', 'Importar conteúdo'], ['radar', 'Usar notícia do Radar']] as const).map(([mode, label]) => <button className="button button-outline" key={mode} onClick={() => { choose(mode); setOpen(false) }}>{label}</button>)}</div>}</div>
}

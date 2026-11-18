import { useState } from 'react'
import type { Briefing, Draft } from '../campaigns/contract'
import { RuleDetails } from './Assistant'
import { campaignScope, recordEditorialFeedback, useEditorialMemory } from './feedback'
import type { Recommendation } from './decision'
import { useAssistantSignal } from './signals'
import { assessments, channels, type Insight } from './types'

const accessLabels = { metadata: 'Somente metadados do Radar', unavailable: 'Fonte inacessível', reviewed: 'Material consultado por mim' }
function focus(id: string) {
  const element = document.getElementById(id)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: 'nearest' })
}

export function BriefingIntelligence({ draft, recommendations, findings, active, current, edit }: {
  draft: Draft; recommendations: Recommendation[]; findings: Insight[]; active: boolean; current: boolean; edit: (patch: Partial<Briefing>) => void
}) {
  const [message, setMessage] = useState('')
  const scope = campaignScope(draft)
  const memory = useEditorialMemory()
  const available = recommendations.filter(item => !memory.history.some(entry => entry.scope === scope &&
    entry.id === `${draft.id}:${item.id}` && entry.outcome === 'dismissed'))
  const applicable = available.filter(item => item.patch || item.instruction && !draft.briefing.acceptedRules?.includes(item.ruleId ?? ''))
  const focusBriefing = () => focus('campaign-briefing-heading')
  function apply(items: Recommendation[]) {
    if (!active || !current || !items.length) return
    const patch = Object.assign({}, ...items.map(item => item.patch))
    const changes = [patch.format && `Formato: ${patch.format === 'carousel' ? 'Carrossel' : 'Post único'}`, patch.approach && `Abordagem: ${patch.approach}`].filter(Boolean)
    if (changes.length && !window.confirm(`Atualizar o briefing?\n\n${changes.join('\n')}\n\nA quantidade configurada de slides permanece gravada.`)) return
    const acceptedRules = [...new Set([...(draft.briefing.acceptedRules ?? []), ...items.flatMap(item => item.instruction && item.ruleId ? [item.ruleId] : [])])].slice(-12)
    edit({ ...patch, acceptedRules })
    for (const item of items) recordEditorialFeedback({ scope, id: `${draft.id}:${item.id}`, ruleId: item.ruleId, preference: item.preference, outcome: 'accepted' })
    setMessage('Briefing atualizado. Gere o prompt para incluir as novas orientações.')
  }
  function dismiss(items: Recommendation[]) {
    for (const item of items) recordEditorialFeedback({ scope, id: `${draft.id}:${item.id}`, ruleId: item.ruleId, preference: item.preference, outcome: 'dismissed' })
    setMessage('Briefing mantido.')
  }

  const lead = available.find(item => item.id === 'SRC-005') ?? available.find(item => item.id === 'comparar-fontes') ?? available[0]
  useAssistantSignal(active && current && lead ? {
    area: 'radar', scope, priority: 20, preference: lead.preference,
    insight: { ...lead, id: `${draft.id}:${lead.id}`, actions: [
      { label: 'Abrir briefing', run: focusBriefing },
      ...(applicable.includes(lead) && lead.patch ? [{ label: 'Aplicar ao briefing', run: () => apply([lead]) }] : []),
      ...(draft.article ? [{ label: 'Ver fonte no briefing', run: () => focus('campaign-source-heading') }] : []),
    ] },
  } : undefined)
  const finding = findings[0]
  useAssistantSignal(active && current && finding ? {
    area: 'radar', scope, priority: 30,
    insight: { ...finding, id: `${draft.id}:review:${finding.id}`, actions: [{ label: 'Abrir revisão da campanha', run: () => focus('campaign-review-heading') }] },
  } : undefined)

  return <section className="campaign-panel editorial-briefing" aria-labelledby="editorial-briefing-title">
    <h3 id="editorial-briefing-title">Inteligência editorial</h3>
    <details><summary>Contexto e perfil</summary>
      <div className="campaign-fields">
        <label>Perfil editorial<input maxLength={80} value={draft.briefing.editorialProfile ?? ''} onChange={event => edit({ editorialProfile: event.target.value })} placeholder="Opcional. Use o mesmo nome nas campanhas do perfil." /></label>
        <label>Canal de destino<select value={draft.briefing.channel ?? ''} onChange={event => edit({ channel: channels.find(channel => channel === event.target.value) })}>
          <option value="">Sem canal definido</option>{channels.map(channel => <option key={channel}>{channel}</option>)}
        </select></label>
        {(draft.article || draft.content?.sources.length) ? <label>Acesso às fontes<select value={draft.briefing.sourceAccess ?? 'metadata'}
          onChange={event => edit({ sourceAccess: event.target.value as Briefing['sourceAccess'] })}>
          {Object.entries(accessLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label> : null}
        {(draft.opportunity?.articles.length ?? draft.content?.sources.length ?? 0) > 1 &&
          <label className="editorial-checkbox"><input type="checkbox" checked={!!draft.briefing.sourceConflict} onChange={event => edit({ sourceConflict: event.target.checked })} /> Registrei divergência entre fontes</label>}
      </div>
    </details>
    <details><summary>Recomendações · {available.length}</summary>
      {available.length === 0 && <p>Briefing mantido. Novos sinais aparecem conforme o contexto.</p>}
      {available.map(item => <article key={item.id} className="editorial-insight">
        <h4>{item.title}</h4><small>{assessments[item.assessment]}</small>
        <details><summary>Explicar sugestão</summary><RuleDetails insight={item} /></details>
        {applicable.includes(item) && <button type="button" className="button button-outline" disabled={!current} onClick={() => apply([item])}>Aplicar recomendação</button>}
      </article>)}
      <div className="campaign-actions">
        {applicable.length > 0 && <button type="button" className="button button-dark" disabled={!current} onClick={() => apply(applicable)}>Aplicar recomendações compatíveis</button>}
        {available.length > 0 && <button type="button" className="button button-outline" disabled={!current} onClick={() => dismiss(available)}>Manter briefing atual</button>}
      </div>
    </details>
    {draft.content && <details><summary>Verificação editorial · {findings.length} {findings.length === 1 ? 'ponto' : 'pontos'}</summary>
      {findings.length === 0 && <p>As verificações locais não apontaram ocorrências. Confira os fatos e a versão final.</p>}
      {findings.map(item => <article className="editorial-insight" key={item.id}>
        <h4>{item.title}</h4><small>{assessments[item.assessment]}</small><RuleDetails insight={item} />
      </article>)}
    </details>}
    {message && <p role="status">{message}</p>}
  </section>
}

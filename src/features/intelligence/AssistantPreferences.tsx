import { explainRule } from './knowledge'
import { resetEditorialMemory, setAssistantMode, useEditorialMemory } from './feedback'

export function AssistantPreferences() {
  const memory = useEditorialMemory()
  return <details className="editorial-preferences">
    <summary>Histórico e preferências</summary>
    <label>Notificações<select value={memory.mode} onChange={event => setAssistantMode(event.target.value as typeof memory.mode)}>
      <option value="proactive">Proativas</option><option value="manual">Somente ao abrir</option><option value="muted">Silenciadas</option>
    </select></label>
    {memory.history.length ? <ul>{memory.history.slice(-6).reverse().map(entry => <li key={JSON.stringify([entry.scope, entry.id])}>
      {entry.id === 'radar:article' ? 'Sugestão de pauta' : explainRule(entry.ruleId ?? '')?.rule.name ?? 'Orientação editorial'}
      {' · '}{entry.outcome === 'accepted' ? 'Aceita' : 'Dispensada'}{' · '}{new Date(entry.at).toLocaleDateString('pt-BR')}
    </li>)}</ul> : <p>Sem decisões registradas neste navegador.</p>}
    <button disabled={!memory.history.length} onClick={() => { if (window.confirm('Limpar o histórico e as preferências editoriais deste navegador?')) resetEditorialMemory() }}>Redefinir memória editorial</button>
  </details>
}

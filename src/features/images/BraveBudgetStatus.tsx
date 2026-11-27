import { useEffect, useState, type FormEvent } from 'react'
import type { BudgetCommand, BudgetResult } from '../../../worker/braveBudget'
import { openverseEnabled, setOpenverseEnabled } from './openverse'

type Status = BudgetResult & { canManage?: boolean; freeOnly?: boolean }
const fallback: Status = { state: 'unavailable', allowed: false }
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 }).format(cents / 100)
const date = (instant: string) => new Date(instant).toLocaleString('pt-BR')
const reasons: Record<string, string> = {
  provider: 'A conta Brave ainda precisa ser habilitada na configuração protegida.',
  paused: 'Pesquisa Brave pausada pelo proprietário.',
  cycle: 'O período vigente do crédito gratuito precisa ser confirmado.',
  cycle_conflict: 'O período informado conflita com o histórico do contador.',
  payment: 'A Brave recusou a consulta por falta de crédito. A pesquisa está pausada neste período.',
  rate: 'A Brave limitou temporariamente a frequência de consultas.',
  request_pending: 'Há uma consulta em processamento ou aguardando conciliação.',
  confirmation_expired: 'Confirme novamente o crédito gratuito. A confirmação vale 24 horas.',
  total_limit: 'O limite total de consultas foi atingido.',
  safety_reserve: 'O crédito restante atingiu a reserva de segurança.',
  confirmation: 'A confirmação precisa corresponder ao crédito gratuito autorizado para este período.',
  storage: 'O contador está indisponível. A pesquisa Brave está bloqueada.',
}

export function BraveAttribution() {
  return <a href="https://brave.com/search/" target="_blank" rel="noreferrer" aria-label="POWERED BY BRAVE" className="brave-attribution">
    <img src="/attribution/brave_color_lightbackground.png" alt="" /><strong>POWERED BY BRAVE</strong>
  </a>
}

async function getBudget(command?: Exclude<BudgetCommand, { action: 'reserve' | 'finish' | 'status' }>, signal?: AbortSignal): Promise<Status> {
  const response = await fetch('/api/visual/budget', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(command ?? {}), credentials: 'same-origin', signal })
  return response.ok || response.status === 409 ? response.json() : fallback
}

export function BraveBudgetStatus() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [openverse, setOpenverse] = useState(openverseEnabled)
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    void getBudget(undefined, abort.signal).then(value => {
      if (!abort.signal.aborted) setStatus(value)
    }, () => { if (!abort.signal.aborted) setStatus(fallback) })
    return () => abort.abort()
  }, [open])
  const refresh = async (command?: Parameters<typeof getBudget>[0]) => {
    setBusy(true)
    setMessage('')
    try {
      const result = await getBudget(command)
      if (result.state === 'invalid' || result === fallback || (command && result.reason === 'storage')) {
        setMessage(reasons[result.reason ?? ''] ?? 'Não foi possível consultar ou salvar o consumo.')
        return
      }
      setStatus(result)
      setMessage(command ? 'Configuração registrada.' : 'Consumo atualizado.')
    } catch { setMessage('Não foi possível consultar ou salvar o consumo.') }
    finally { setBusy(false) }
  }
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const automaticLimit = Number(data.get('automaticLimit'))
    const totalLimit = Number(data.get('totalLimit'))
    if (automaticLimit > totalLimit) {
      setMessage('O limite automático precisa caber no limite total.')
      return
    }
    void refresh({ action: 'settings', settings: { automaticLimit, totalLimit } })
  }
  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void refresh({ action: 'confirm', availableCents: Math.round(Number(data.get('available')) * 100) })
  }
  const totals = status?.totals
  const limited = status?.reason ? reasons[status.reason] : undefined
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="budget-settings">
    <summary>Consumo e franquias</summary>
    {open && <>
      <p>Modo exclusivamente gratuito ativo.</p>
      <p>Fontes originais continuam disponíveis conforme o acesso de cada publicação.</p>
      <label><input type="checkbox" checked={openverse} onChange={event => {
        try {
          setOpenverseEnabled(event.target.checked)
          setOpenverse(event.target.checked)
          setMessage('')
        } catch { setMessage('Não foi possível salvar a preferência do Openverse neste navegador.') }
      }} /> Permitir buscas gratuitas do Openverse neste navegador</label>
      <section aria-label="Brave Search">
        <BraveAttribution />
        <p role="status">{!status ? 'Consultando consumo…' : limited ??
          (status.state === 'ready' ? 'Pesquisa Brave disponível.' : status.state === 'disabled' ? 'Pesquisa Brave desativada.' : 'Pesquisa Brave indisponível.')}</p>
        <button type="button" className="button button-outline" disabled={busy} onClick={() => void refresh()}>Atualizar consumo</button>
        {totals && <dl>
          <dt>Consultas neste período</dt><dd>{totals.web + totals.images} ({totals.web} Web, {totals.images} Images)</dd>
          <dt>Por finalidade</dt><dd>{totals.automatic} automáticas, {totals.manual} manuais, {totals.diagnostic} de diagnóstico</dd>
          {status?.totalLimit !== undefined && <><dt>Limite autorizado</dt><dd>Total {status.totalLimit} · Automáticas {status.automaticLimit}</dd></>}
          <dt>Consumo estimado</dt><dd>{money(totals.cents + (status?.priorCents ?? 0))}{status?.limitCents !== undefined && ` de ${money(status.limitCents)} em crédito gratuito confirmado`}</dd>
          {status?.reserveCents !== undefined && <><dt>Reserva de segurança</dt><dd>{money(status.reserveCents)} preservados · Busca manual e diagnóstico: até {status.manualReserveRemaining ?? 0}</dd></>}
          {status?.remaining !== undefined && <><dt>Consultas restantes</dt><dd>Total estimado {status.remaining} · Automáticas {status.automaticRemaining}</dd></>}
          {status?.confirmedAt && <><dt>Última confirmação</dt><dd>{date(status.confirmedAt)}</dd></>}
          {status?.end && <><dt>Fim do período informado</dt><dd>{date(status.end)}</dd></>}
        </dl>}
        <small>O saldo oficial fica no painel da Brave.</small>
        {status?.canManage && <>
          <div><button type="button" className="button button-outline" disabled={busy} onClick={() => void refresh({
            action: 'settings', settings: { enabled: status.settings?.enabled === false },
          })}>{status.settings?.enabled === false ? 'Retomar pesquisa Brave' : 'Pausar pesquisa Brave'}</button></div>
          <form onSubmit={save} key={`${status.totalLimit}/${status.automaticLimit}`}>
            <label>Limite total de consultas <input name="totalLimit" type="number" min="0" max="1000" required defaultValue={status.totalLimit ?? status.settings?.totalLimit} /></label>
            <label>Limite de consultas automáticas <input name="automaticLimit" type="number" min="0" max="900" required defaultValue={status.automaticLimit ?? status.settings?.automaticLimit} /></label>
            <button type="submit" className="button button-outline" disabled={busy}>Salvar limites</button>
          </form>
          {status.end && <form onSubmit={confirm}>
            <label>Crédito gratuito disponível no painel (US$) <input name="available" type="number" min="0" max="5" step="0.01" required /></label>
            <label><input type="checkbox" required /> Conferi o período, o saldo exclusivamente gratuito e a recarga automática desligada.</label>
            <button type="submit" className="button button-outline" disabled={busy}>Confirmar franquia</button>
          </form>}
        </>}
        {message && <p role="status">{message}</p>}
      </section>
      <details><summary>Histórico de consumo</summary>
        {status?.history?.length ? <ul>{status.history.map(item => <li key={item.cycle}>
          {date(item.cycle)} a {date(item.end)} · {item.totals.web + item.totals.images} consultas · {money(item.totals.cents)} reservados pelo Post Machine
        </li>)}</ul> : <p>Nenhum período anterior registrado.</p>}
      </details>
    </>}
  </details>
}


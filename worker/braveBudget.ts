// A single Durable Object serializes reservations across every Worker isolate.
export type BudgetConfig = {
  start: string; end: string; confirmedAt: string; freeCents: number; reserveCents: number
  priorCents: number; priceCents: number; automaticLimit: number; totalLimit: number
}
export type BudgetPurpose = 'automatic' | 'manual' | 'diagnostic'
type SearchKind = 'web' | 'images'
type Totals = Record<SearchKind | BudgetPurpose | 'cents', number>
type Confirmation = { at: string; availableCents: number; meteredCents: number }
export type BudgetSettings = { enabled?: boolean; automaticLimit?: number; totalLimit?: number }
type Cycle = { cycle: string; end: string; totals: Totals; blockedUntil?: number; exhausted?: boolean
  active?: { id: string; at: number }; confirmation?: Confirmation; priorCents?: number; limitCents?: number }
type ProviderResult = 'complete' | 'payment' | 'rate'
export type BudgetCommand = { action: 'status' } | { action: 'reserve'; kind: SearchKind; purpose: BudgetPurpose } |
  { action: 'finish'; lease: string; outcome: ProviderResult; until?: number } |
  { action: 'settings'; settings: BudgetSettings } | { action: 'confirm'; availableCents: number }
export type BudgetResult = {
  state: 'ready' | 'busy' | 'limited' | 'exhausted' | 'disabled' | 'unconfirmed' | 'unavailable' | 'invalid'
  allowed: boolean; reason?: string; lease?: string; totals?: Totals; start?: string; end?: string
  confirmedAt?: string; limitCents?: number; reserveCents?: number; priorCents?: number; totalLimit?: number
  automaticLimit?: number; remaining?: number; automaticRemaining?: number; manualReserveRemaining?: number
  settings?: BudgetSettings; history?: Pick<Cycle, 'cycle' | 'end' | 'totals' | 'priorCents' | 'limitCents'>[]
}
const day = 86_400_000
const zero = (): Totals => ({ web: 0, images: 0, automatic: 0, manual: 0, diagnostic: 0, cents: 0 })
const iso = (value: unknown) => typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : ''
const number = (value: unknown) => typeof value === 'number' ||
  (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) ? Number(value) : NaN

export function budgetConfig(env: Record<string, unknown>, now = Date.now()): BudgetConfig | undefined {
  const start = iso(env.BRAVE_CYCLE_START)
  const end = iso(env.BRAVE_CYCLE_END)
  const confirmedAt = iso(env.BRAVE_BALANCE_CONFIRMED_AT)
  const freeCents = number(env.BRAVE_FREE_CREDIT_CENTS)
  const reserveCents = number(env.BRAVE_SAFETY_RESERVE_CENTS ?? '50')
  const priorCents = number(env.BRAVE_PRIOR_USAGE_CENTS)
  const priceCents = number(env.BRAVE_PRICE_CENTS)
  const automaticLimit = number(env.BRAVE_AUTOMATIC_LIMIT)
  const totalLimit = number(env.BRAVE_TOTAL_LIMIT)
  if (!start || !end || !confirmedAt || Date.parse(start) >= Date.parse(end) ||
    Date.parse(end) - Date.parse(start) > 32 * day || confirmedAt < start || confirmedAt >= end ||
    Date.parse(confirmedAt) > now || ![freeCents, reserveCents, automaticLimit, totalLimit].every(Number.isInteger) ||
    ![priorCents, priceCents].every(value => Number.isInteger(value * 2)) ||
    freeCents <= 0 || freeCents > 500 || reserveCents <= 0 || reserveCents > 500 ||
    priorCents < 0 || priorCents > 500 || priceCents <= 0 || priceCents > 500 ||
    automaticLimit < 0 || automaticLimit > 900 || automaticLimit > totalLimit || totalLimit > 1000) return
  return { start, end, confirmedAt, freeCents, reserveCents, priorCents, priceCents, automaticLimit, totalLimit }
}

function report(state: BudgetResult['state'], reason?: string): BudgetResult {
  return { allowed: false, state, reason }
}
type BudgetTransaction = { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }

export class BraveBudget {
  constructor(private state: { storage: { transaction<T>(callback: (tx: BudgetTransaction) => Promise<T>): Promise<T> } }) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return Response.json(report('invalid'), { status: 405 })
    try {
      const { config, command, providerEnabled } = await request.json() as {
        config?: BudgetConfig; command: BudgetCommand; providerEnabled: boolean
      }
      // Keep the token stable if storage retries the transaction.
      const reservation = command.action === 'reserve' ? crypto.randomUUID() : undefined
      return Response.json(await this.state.storage.transaction(async tx => {
        const current = await tx.get<Cycle>('budget')
        if (command.action === 'finish') {
          if (current?.active?.id !== command.lease) return report('invalid')
          const next = { ...current, active: undefined,
            exhausted: current.exhausted || command.outcome === 'payment',
            blockedUntil: command.outcome === 'rate' ? Math.max(current.blockedUntil ?? 0, command.until ?? 0) : current.blockedUntil }
          await tx.put('budget', next)
          return report('ready')
        }

        const settings = await tx.get<BudgetSettings>('settings') ?? {}
        if (command.action === 'settings') {
          Object.assign(settings, command.settings)
          await tx.put('settings', settings)
        }
        const now = Date.now()
        const history = command.action === 'status' || command.action === 'settings' || command.action === 'confirm'
          ? await tx.get<BudgetResult['history']>('history') ?? [] : undefined
        const details = { settings, history, totals: current?.totals, start: current?.cycle, end: current?.end,
          limitCents: current?.limitCents, priorCents: current?.priorCents }
        const status = (state: BudgetResult['state'], reason?: string): BudgetResult => ({ ...details, ...report(state, reason) })
        if (!config || now < Date.parse(config.start) || now >= Date.parse(config.end))
          return status(command.action === 'confirm' ? 'invalid' : providerEnabled ? 'unconfirmed' : 'disabled', providerEnabled ? 'cycle' : 'provider')
        const sameCycle = current && Date.parse(current.cycle) === Date.parse(config.start)
        if (current && (sameCycle ? Date.parse(current.end) !== Date.parse(config.end) :
          Date.parse(config.start) < Date.parse(current.end) || (current.active && now - current.active.at < day)))
          return status(command.action === 'confirm' ? 'invalid' : 'unconfirmed', 'cycle_conflict')
        const cycle: Cycle = sameCycle ? current : { cycle: config.start, end: config.end, totals: zero(), blockedUntil: current?.exhausted ? undefined : current?.blockedUntil }
        const save = async () => {
          if (current && !sameCycle) {
            const past = history ?? await tx.get<NonNullable<BudgetResult['history']>>('history') ?? []
            const { cycle, end, totals, priorCents, limitCents } = current
            await tx.put('history', [{ cycle, end, totals, priorCents, limitCents }, ...past].slice(0, 12))
          }
          await tx.put('budget', cycle)
        }

        const { totals } = cycle
        const priorCents = Math.max(config.priorCents, cycle.priorCents ?? 0)
        const limitCents = Math.min(config.freeCents, cycle.limitCents ?? config.freeCents)
        if (command.action === 'confirm') {
          if (!providerEnabled || cycle.active || command.availableCents > limitCents)
            return status('invalid', cycle.active ? 'request_pending' : 'confirmation')
          cycle.confirmation = { at: new Date(now).toISOString(), availableCents: command.availableCents, meteredCents: totals.cents }
          cycle.priorCents = priorCents
          cycle.limitCents = limitCents
          await save()
        }

        const confirmedAt = cycle.confirmation?.at ?? config.confirmedAt
        const totalLimit = Math.min(config.totalLimit, settings.totalLimit ?? config.totalLimit)
        const automaticLimit = Math.min(config.automaticLimit, totalLimit, settings.automaticLimit ?? config.automaticLimit)
        const count = totals.web + totals.images
        const limit = limitCents - priorCents - totals.cents
        const confirmedAvailable = cycle.confirmation ? cycle.confirmation.availableCents - (totals.cents - cycle.confirmation.meteredCents) : limit
        const unspent = Math.min(confirmedAvailable, limit) - config.reserveCents
        const remaining = Math.max(0, Math.min(totalLimit - count, Math.floor(unspent / config.priceCents)))
        const manualRemaining = totalLimit - automaticLimit - totals.manual - totals.diagnostic
        const budgets = (left: number) => ({ remaining: left,
          automaticRemaining: Math.max(0, Math.min(left, automaticLimit - totals.automatic)),
          manualReserveRemaining: Math.max(0, Math.min(left, totalLimit - automaticLimit - totals.manual - totals.diagnostic)) })
        const view: BudgetResult = { ...details, state: 'ready', allowed: false, totals, limitCents, priorCents, totalLimit, automaticLimit,
          start: config.start, end: config.end, confirmedAt, reserveCents: config.reserveCents, ...budgets(remaining) }
        const deny = (state: BudgetResult['state'], reason: string): BudgetResult => ({ ...view, state, reason })
        if (!providerEnabled || settings.enabled === false) return deny('disabled', !providerEnabled ? 'provider' : 'paused')
        if (cycle.exhausted) return deny('limited', 'payment')
        if ((cycle.blockedUntil ?? 0) > now) return deny('limited', 'rate')
        if (cycle.active) return deny(now - cycle.active.at > 15_000 ? 'unavailable' : 'busy', 'request_pending')
        if (now - Date.parse(confirmedAt) > day) return deny('unconfirmed', 'confirmation_expired')
        if (!remaining) return deny('exhausted', totalLimit <= count ? 'total_limit' : 'safety_reserve')
        if (command.action !== 'reserve' || !reservation) return view
        if (command.purpose === 'automatic' ? totals.automatic >= automaticLimit : manualRemaining <= 0)
          return deny('exhausted', command.purpose === 'automatic' ? 'automatic_limit' : 'manual_limit')

        totals[command.kind]++
        totals[command.purpose]++
        totals.cents += config.priceCents
        cycle.active = { id: reservation, at: now }
        cycle.priorCents = priorCents
        cycle.limitCents = limitCents
        await save()
        return { ...view, allowed: true, lease: reservation, ...budgets(remaining - 1) } satisfies BudgetResult
      }))
    } catch { return Response.json(report('unavailable', 'storage'), { status: 503 }) }
  }
}

export type BudgetBinding = { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
export async function budgetStatus(binding: BudgetBinding | undefined, config: BudgetConfig | undefined,
  command: BudgetCommand = { action: 'status' }, providerEnabled = true): Promise<BudgetResult> {
  if (!binding) return report('unavailable', 'storage')
  try {
    const stub = binding.get(binding.idFromName('brave-search-account'))
    const response = await stub.fetch(new Request('https://budget.internal/', { method: 'POST',
      body: JSON.stringify({ config, command, providerEnabled }) }))
    if (response.ok) return await response.json() as BudgetResult
  } catch { /* Fail closed when the counter is unavailable. */ }
  return report('unavailable', 'storage')
}


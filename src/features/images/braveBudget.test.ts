// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { BraveBudget, budgetConfig, budgetStatus, type BudgetPurpose } from '../../../worker/braveBudget'

const now = Date.now()
const start = new Date(now - 86400000).toISOString()
const end = new Date(now + 86400000).toISOString()
const env = (extra: object = {}) => ({ BRAVE_CYCLE_START: start, BRAVE_CYCLE_END: end,
  BRAVE_BALANCE_CONFIRMED_AT: new Date(now - 80000000).toISOString(), BRAVE_FREE_CREDIT_CENTS: '500',
  BRAVE_PRIOR_USAGE_CENTS: '0', BRAVE_PRICE_CENTS: '1', BRAVE_AUTOMATIC_LIMIT: '2', BRAVE_TOTAL_LIMIT: '3', ...extra })

function fixture() {
  const entries = new Map<string, unknown>()
  let queue = Promise.resolve()
  let failWrites = false
  const storage = { transaction: async <T>(callback: (tx: {
    get<V>(key: string): Promise<V | undefined>; put(key: string, entry: unknown): Promise<void>
  }) => Promise<T>) => {
    const pending = queue.then(async () => {
      const working = structuredClone(entries)
      const result = await callback({ get: async entry => working.get(entry) as never, put: async (key, entry) => {
        if (failWrites) throw Error('storage')
        working.set(key, entry)
      } })
      for (const [key, entry] of working) entries.set(key, entry)
      return result
    })
    queue = pending.then(() => undefined, () => undefined)
    return pending
  } }
  return { idFromName: () => 'same-object', get: () => new BraveBudget({ storage }), fail: (value: boolean) => { failWrites = value } }
}

const reserve = (binding: ReturnType<typeof fixture>, config = budgetConfig(env())!,
  purpose: BudgetPurpose = 'automatic', kind: 'web' | 'images' = 'web') =>
  budgetStatus(binding, config, { action: 'reserve', kind, purpose })
const finish = (binding: ReturnType<typeof fixture>, lease: string, outcome: 'complete' | 'payment' | 'rate' = 'complete') =>
  budgetStatus(binding, undefined, { action: 'finish', lease, outcome, until: now + 60_000 })

describe('orçamento central Brave', () => {
  it('exige saldo e ciclo confirmados, incluindo consumo anterior vazio', async () => {
    expect(budgetConfig({})).toBeUndefined()
    expect(budgetConfig(env({ BRAVE_CYCLE_END: '' }))).toBeUndefined()
    expect(budgetConfig(env({ BRAVE_PRIOR_USAGE_CENTS: 'unknown' }))).toBeUndefined()
    expect(budgetConfig(env({ BRAVE_PRIOR_USAGE_CENTS: '' }))).toBeUndefined()
    expect(budgetConfig(env({ BRAVE_PRICE_CENTS: '0' }))).toBeUndefined()
    const stale = budgetConfig(env({ BRAVE_CYCLE_START: new Date(now - 26 * 3600000).toISOString(),
      BRAVE_BALANCE_CONFIRMED_AT: new Date(now - 25 * 3600000).toISOString() }))
    expect((await budgetStatus(fixture(), stale)).reason).toBe('confirmation_expired')
  })

  it('serializa Web, Images e finalidades entre instâncias e mantém a reserva manual', async () => {
    const binding = fixture(), config = budgetConfig(env())!
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      reserve(binding, config, index === 0 ? 'automatic' : 'diagnostic', index % 2 ? 'images' : 'web')))
    expect(attempts.filter(value => value.allowed)).toHaveLength(1)
    expect(attempts.filter(value => value.state === 'busy')).toHaveLength(7)
    await finish(binding, attempts[0].lease!)
    await finish(binding, (await reserve(binding, config, 'automatic', 'images')).lease!)
    expect((await reserve(binding)).reason).toBe('automatic_limit')
    await finish(binding, (await reserve(binding, config, 'manual', 'images')).lease!)
    expect((await reserve(binding, config, 'diagnostic')).allowed).toBe(false)
    expect((await budgetStatus(binding, config)).totals).toMatchObject({ automatic: 2, manual: 1, images: 2, web: 1 })
  })

  it('preserva reserva monetária e falha fechado com erro de armazenamento', async () => {
    const binding = fixture()
    const config = budgetConfig(env({ BRAVE_FREE_CREDIT_CENTS: '5', BRAVE_SAFETY_RESERVE_CENTS: '2', BRAVE_PRICE_CENTS: '3' }))!
    binding.fail(true)
    expect((await reserve(binding, config)).reason).toBe('storage')
    binding.fail(false)
    const initial = await reserve(binding, config)
    expect(initial.allowed).toBe(true)
    binding.fail(true)
    expect((await finish(binding, initial.lease!)).allowed).toBe(false)
    expect((await reserve(binding, config)).reason).toBe('request_pending')
    binding.fail(false)
    await finish(binding, initial.lease!)
    expect((await reserve(binding, config)).reason).toBe('safety_reserve')
  })

  it('mantém a contagem, o maior consumo anterior e o fim do ciclo quando a configuração muda', async () => {
    const binding = fixture()
    const config = budgetConfig(env({ BRAVE_PRIOR_USAGE_CENTS: '120' }))!
    await finish(binding, (await reserve(binding, config)).lease!)
    const overlap = budgetConfig(env({ BRAVE_CYCLE_START: new Date(now - 43200000).toISOString(),
      BRAVE_BALANCE_CONFIRMED_AT: new Date(now - 3600000).toISOString() }))!
    const shorter = budgetConfig(env({ BRAVE_CYCLE_END: new Date(now + 43200000).toISOString() }))!
    expect((await reserve(binding, overlap)).reason).toBe('cycle_conflict')
    expect((await reserve(binding, shorter)).reason).toBe('cycle_conflict')
    expect(await budgetStatus(binding, budgetConfig(env()))).toMatchObject({ priorCents: 120, totals: { web: 1 } })
  })

  it('renova após término e nova confirmação e conserva o período anterior no histórico', async () => {
    const binding = fixture(), config = budgetConfig(env())!
    await finish(binding, (await reserve(binding)).lease!)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(now + 2 * 86400000)
      const next = budgetConfig(env({ BRAVE_CYCLE_START: end,
        BRAVE_CYCLE_END: new Date(now + 4 * 86400000).toISOString(),
        BRAVE_BALANCE_CONFIRMED_AT: new Date(now + 2 * 86400000).toISOString() }))!
      const call = await reserve(binding, next, 'automatic', 'images')
      expect(call.totals).toMatchObject({ web: 0, images: 1 })
      await finish(binding, call.lease!)
      expect((await reserve(binding, config)).allowed).toBe(false)
      expect((await budgetStatus(binding, next)).history).toMatchObject([{ cycle: start, totals: { web: 1, images: 0 } }])
    } finally { vi.useRealTimers() }
  })

  it('persiste 429 e 402 no mesmo ciclo e não os limpa com confirmação manual', async () => {
    const binding = fixture()
    await finish(binding, (await reserve(binding)).lease!, 'rate')
    expect((await reserve(binding)).reason).toBe('rate')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(now + 61000)
      await finish(binding, (await reserve(binding)).lease!, 'payment')
      expect((await budgetStatus(binding, budgetConfig(env()), { action: 'confirm', availableCents: 450 })).reason).toBe('payment')
      expect((await reserve(binding)).reason).toBe('payment')
    } finally { vi.useRealTimers() }
  })

  it('pausa globalmente e usa a confirmação manual como teto para o saldo restante', async () => {
    const binding = fixture(), config = budgetConfig(env())!
    await budgetStatus(binding, config, { action: 'settings', settings: { enabled: false, totalLimit: 2 } })
    expect((await reserve(binding)).reason).toBe('paused')
    await budgetStatus(binding, config, { action: 'settings', settings: { enabled: true } })
    await budgetStatus(binding, config, { action: 'confirm', availableCents: 51 })
    await finish(binding, (await reserve(binding)).lease!)
    expect((await reserve(binding)).reason).toBe('safety_reserve')
  })
})


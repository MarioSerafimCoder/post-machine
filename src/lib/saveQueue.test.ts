import { expect, it, vi } from 'vitest'
import { SaveQueue } from './saveQueue'

it('serializa escritas em voo e conserva a última edição', async () => {
  let release!: () => void
  const values: number[] = []
  const write = vi.fn(async (value: number) => { if (value === 1) await new Promise<void>(resolve => { release = resolve }); values.push(value) })
  const queue = new SaveQueue(write, () => undefined, 10000)
  queue.schedule('a', 1)
  const first = queue.flush('a')
  queue.schedule('a', 2)
  queue.schedule('a', 3)
  release()
  await first
  expect(values).toEqual([1, 3])
  expect(queue.hasPending).toBe(false)
})

it('preserva pendências após falha e permite retentativa', async () => {
  const write = vi.fn().mockRejectedValueOnce(Error('QuotaExceededError')).mockResolvedValue(undefined)
  const report = vi.fn()
  const queue = new SaveQueue(write, report, 10000)
  queue.schedule('a', 'última edição')
  await expect(queue.flushAll()).rejects.toThrow('QuotaExceededError')
  expect(queue.hasPending).toBe(true)
  expect(report).toHaveBeenCalledWith('a', 'error', expect.objectContaining({ message: 'QuotaExceededError' }))
  await queue.flushAll()
  expect(write).toHaveBeenLastCalledWith('última edição')
  expect(queue.hasPending).toBe(false)
})

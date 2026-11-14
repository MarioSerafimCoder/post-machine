/** Debounces each document and serializes writes; failed snapshots remain retryable. */
export class SaveQueue<T> {
  private pending = new Map<string, T>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private running = new Map<string, Promise<void>>()
  constructor(private write: (value: T) => Promise<unknown>, private report: (id: string, state: 'saving' | 'saved' | 'error') => void, private delay = 350) {}
  schedule(id: string, value: T) {
    this.pending.set(id, value)
    clearTimeout(this.timers.get(id))
    this.report(id, 'saving')
    this.timers.set(id, setTimeout(() => { void this.flush(id).catch(() => undefined) }, this.delay))
  }
  async flush(id: string): Promise<void> {
    clearTimeout(this.timers.get(id))
    const active = this.running.get(id)
    if (active) { await active; if (this.pending.has(id)) return this.flush(id); return }
    if (!this.pending.has(id)) return
    const run = async () => {
      while (this.pending.has(id)) {
        const value = this.pending.get(id)!
        try { await this.write(value) }
        catch (error) { this.report(id, 'error'); throw error }
        if (this.pending.get(id) === value) this.pending.delete(id)
      }
      this.report(id, 'saved')
    }
    const promise = run()
    this.running.set(id, promise)
    try { await promise } finally { this.running.delete(id) }
  }
  async flushAll() { await Promise.all([...this.pending.keys()].map(id => this.flush(id))) }
  get hasPending() { return this.pending.size > 0 }
}

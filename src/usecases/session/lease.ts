import type { Lease, LeaseWaiter } from "./types.ts"

export class SessionLeases {
  #accepting = true
  #active = false
  #waiting: LeaseWaiter[] = []
  #drains: PromiseWithResolvers<void>[] = []

  acquire(signal: AbortSignal): Promise<Lease | null> {
    if (!this.#accepting || signal.aborted) return Promise.resolve(null)
    const result = Promise.withResolvers<Lease | null>()
    const waiter: LeaseWaiter = {
      signal,
      result,
      cancel: () => this.#cancel(waiter),
    }
    this.#waiting.push(waiter)
    signal.addEventListener("abort", waiter.cancel, { once: true })
    this.#advance()
    return result.promise
  }

  stopAdmissions(): void {
    this.#accepting = false
  }

  drain(): Promise<void> {
    if (!this.#active && this.#waiting.length === 0) return Promise.resolve()
    const result = Promise.withResolvers<void>()
    this.#drains.push(result)
    return result.promise
  }

  #cancel(waiter: LeaseWaiter): void {
    const index = this.#waiting.indexOf(waiter)
    if (index === -1) return
    this.#waiting.splice(index, 1)
    waiter.signal.removeEventListener("abort", waiter.cancel)
    waiter.result.resolve(null)
    this.#advance()
  }

  #advance(): void {
    if (this.#active) return
    for (let waiter = this.#waiting.shift(); waiter; waiter = this.#waiting.shift()) {
      waiter.signal.removeEventListener("abort", waiter.cancel)
      if (waiter.signal.aborted) {
        waiter.result.resolve(null)
        continue
      }
      this.#active = true
      waiter.result.resolve(this.#lease())
      return
    }
    for (const drain of this.#drains) drain.resolve()
    this.#drains = []
  }

  #lease(): Lease {
    let released = false
    return {
      release: () => {
        if (released) return
        released = true
        this.#active = false
        this.#advance()
      },
    }
  }
}

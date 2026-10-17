import type { RecordTest } from "./e2e-records.ts"
import type { Waiter } from "./e2e-rpc-types.ts"

export class LineBoard {
  readonly lines: string[] = []
  #waiters: Waiter[] = []
  #failure: Error | null = null

  waitFor(test: RecordTest, from: number): Promise<string> {
    const found = this.lines.slice(from).find(test)
    if (typeof found === "string") return Promise.resolve(found)
    if (this.#failure) return Promise.reject(this.#failure)
    const waiting = Promise.withResolvers<string>()
    this.#waiters.push({ test, resolve: waiting.resolve, reject: waiting.reject })
    return waiting.promise
  }

  add(line: string): void {
    this.lines.push(line)
  }

  settle(line: string): void {
    const matched = this.#waiters.filter((waiter) => waiter.test(line))
    this.#waiters = this.#waiters.filter((waiter) => !matched.includes(waiter))
    for (const waiter of matched) waiter.resolve(line)
  }

  fail(error: Error): void {
    this.#failure ??= error
    for (const waiter of this.#waiters) waiter.reject(this.#failure)
    this.#waiters = []
  }
}

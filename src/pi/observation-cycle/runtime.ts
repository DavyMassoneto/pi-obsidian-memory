import { type MemoryPiContext, STATUS_OBSERVING } from "#src/pi/context"
import {
  assignObservationIds,
  type ChunkRange,
  cycleSettings,
  type FailedChunk,
  ledgerOf,
  nowMs,
  type ObserverDraft,
  observeChunk,
  planObserverChunks,
  recordedData,
  type SessionRecord,
} from "#src/usecases"
import { OBSERVER_FAILED, OBSERVER_RETRY_NOTICE, OBSERVER_UNEXPECTED } from "./constants.ts"
import { recordsOf } from "./records.ts"
import type { ObservationCycleDeps } from "./types.ts"

export class ObservationRuntime {
  #deps: ObservationCycleDeps
  #inFlight: ChunkRange[] = []
  #failed: FailedChunk[] = []
  #told = new Set<string>()
  #abort = new AbortController()

  constructor(deps: ObservationCycleDeps) {
    this.#deps = deps
  }

  reset(): void {
    this.#abort.abort()
    this.#abort = new AbortController()
    this.#inFlight = []
    this.#failed = []
    this.#told = new Set<string>()
  }

  stop(): void {
    this.#abort.abort()
  }

  async tick(ctx: MemoryPiContext): Promise<void> {
    const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return
    const settings = await cycleSettings(operation)
    if (!settings.succeeded) return
    const { chunkTokens, concurrency } = settings.output.observer
    const records = recordsOf(ctx.sessionManager.getBranch())
    const plan = planObserverChunks({
      records,
      ledger: ledgerOf(records),
      inFlight: this.#inFlight,
      failed: this.#failed,
      attempted: [],
      chunkTokens,
      concurrency,
      nowMs: nowMs(),
      until: null,
    })
    for (const range of plan) this.#start(ctx, records, range)
  }

  #start(ctx: MemoryPiContext, records: SessionRecord[], range: ChunkRange): void {
    this.#inFlight.push(range)
    this.#showStatus(ctx)
    void this.#observe(ctx, records, range)
  }

  async #observe(ctx: MemoryPiContext, records: SessionRecord[], range: ChunkRange): Promise<void> {
    const signal = this.#abort.signal
    const inFlight = this.#inFlight
    const problems = await this.#attempt(ctx, records, range)
    if (!signal.aborted && problems.length > 0) this.#reportFailure(ctx, range, problems)
    const index = inFlight.indexOf(range)
    if (index >= 0) inFlight.splice(index, 1)
    this.#showStatus(ctx)
  }

  async #attempt(ctx: MemoryPiContext, records: SessionRecord[], range: ChunkRange): Promise<string[]> {
    try {
      const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return [OBSERVER_UNEXPECTED]
      const signal = AbortSignal.any([operation.signal, this.#abort.signal])
      const result = await observeChunk({ records, range }, { ...operation, signal }, this.#deps.completionOf(ctx))
      if (!result.succeeded) return result.problems
      this.#commit(ctx, range, result.output)
      return []
    } catch (error) {
      if (error instanceof Error) return [error.message]
      return [OBSERVER_UNEXPECTED]
    }
  }

  #commit(ctx: MemoryPiContext, range: ChunkRange, drafts: ObserverDraft[]): void {
    const { used } = ledgerOf(recordsOf(ctx.sessionManager.getBranch()))
    this.#deps.appendObservations(recordedData(range, assignObservationIds(drafts, used)))
  }

  #reportFailure(ctx: MemoryPiContext, range: ChunkRange, problems: string[]): void {
    this.#failed = this.#failed.filter((failure) => failure.fromId !== range.fromId)
    this.#failed.push({ fromId: range.fromId, failedAtMs: nowMs() })
    const notice = `${OBSERVER_FAILED} ${problems.join("; ")}. ${OBSERVER_RETRY_NOTICE}`
    if (this.#told.has(notice)) return
    this.#told.add(notice)
    if (!ctx.hasUI) return
    try {
      ctx.ui.notify(notice, "warning")
    } catch {
      return
    }
  }

  #showStatus(ctx: MemoryPiContext): void {
    if (!ctx.hasUI) return
    let text: string | undefined
    if (this.#inFlight.length > 0) text = STATUS_OBSERVING.text
    try {
      ctx.ui.setStatus(STATUS_OBSERVING.key, text)
    } catch {
      return
    }
  }
}

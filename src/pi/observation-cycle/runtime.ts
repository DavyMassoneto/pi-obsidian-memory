import type { MemoryPiContext } from "#src/pi/context"
import { STATUS_OBSERVING } from "#src/pi/context"
import {
  assignObservationIds,
  type ChunkRange,
  type CompactSessionResult,
  type CycleSettings,
  compactSession,
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
import { CompactionTrigger } from "./compaction-trigger.ts"
import { OBSERVER_FAILED, OBSERVER_RETRY_NOTICE, OBSERVER_UNEXPECTED } from "./constants.ts"
import { tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { IdleRelease, ObservationCycleDeps } from "./types.ts"

export class ObservationRuntime {
  #deps: ObservationCycleDeps
  #inFlight: ChunkRange[] = []
  #failed: FailedChunk[] = []
  #told = new Set<string>()
  #abort = new AbortController()
  #idle: IdleRelease[] = []
  readonly compaction: CompactionTrigger

  constructor(deps: ObservationCycleDeps) {
    this.#deps = deps
    this.compaction = new CompactionTrigger(() => deps.sendResume())
  }

  reset(): void {
    this.#abort.abort()
    this.#abort = new AbortController()
    this.#inFlight = []
    this.#failed = []
    this.#told = new Set<string>()
    this.compaction.reset()
    this.#releaseIdle()
  }

  stop(): void {
    this.#abort.abort()
  }

  async settings(ctx: MemoryPiContext): Promise<CycleSettings | null> {
    const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return null
    const settings = await cycleSettings(operation)
    if (!settings.succeeded) return null
    return settings.output
  }

  async tick(ctx: MemoryPiContext): Promise<void> {
    const settings = await this.settings(ctx)
    if (!settings) return
    const records = recordsOf(ctx.sessionManager.getBranch())
    const plan = this.#plan(records, settings, [], null)
    for (const range of plan) this.#start(ctx, records, range, [])
  }

  async observeBeforeCut(ctx: MemoryPiContext, until: string, signal: AbortSignal): Promise<void> {
    const settings = await this.settings(ctx)
    if (!settings) return
    const own = this.#abort.signal
    const attempted: string[] = []
    await this.whenIdle(signal)
    while (!own.aborted && !signal.aborted) {
      const records = recordsOf(ctx.sessionManager.getBranch())
      const plan = this.#plan(records, settings, attempted, until)
      if (plan.length === 0) return
      for (const range of plan) {
        attempted.push(range.fromId)
        this.#start(ctx, records, range, [signal])
      }
      await this.whenIdle(signal)
    }
  }

  whenIdle(signal: AbortSignal): Promise<void> {
    if (this.#inFlight.length === 0 || signal.aborted) return Promise.resolve()
    const idle = Promise.withResolvers<void>()
    const release = () => {
      signal.removeEventListener("abort", release)
      idle.resolve()
    }
    signal.addEventListener("abort", release, { once: true })
    this.#idle.push(release)
    return idle.promise
  }

  compactSession(ctx: MemoryPiContext, signal: AbortSignal): Promise<CompactSessionResult | null> {
    const operation = this.#deps.sessions.currentOperation(ctx.cwd, this.#deps.paths, signal)
    if (!operation) return Promise.resolve(null)
    return compactSession({ records: recordsOf(ctx.sessionManager.getBranch()) }, operation)
  }

  #plan(records: SessionRecord[], settings: CycleSettings, attempted: string[], until: string | null): ChunkRange[] {
    const { chunkTokens, concurrency } = settings.observer
    return planObserverChunks({
      records,
      ledger: ledgerOf(records),
      inFlight: this.#inFlight,
      failed: this.#failed,
      attempted,
      chunkTokens,
      concurrency,
      nowMs: nowMs(),
      until,
    })
  }

  #start(ctx: MemoryPiContext, records: SessionRecord[], range: ChunkRange, signals: AbortSignal[]): void {
    this.#inFlight.push(range)
    this.#showStatus(ctx)
    void this.#observe(ctx, records, range, signals)
  }

  async #observe(ctx: MemoryPiContext, records: SessionRecord[], range: ChunkRange, signals: AbortSignal[]) {
    const signal = AbortSignal.any([this.#abort.signal, ...signals])
    const inFlight = this.#inFlight
    const problems = await this.#attempt(ctx, records, range, signal)
    if (!signal.aborted && problems.length > 0) this.#reportFailure(ctx, range, problems)
    const index = inFlight.indexOf(range)
    if (index >= 0) inFlight.splice(index, 1)
    this.#showStatus(ctx)
    if (this.#inFlight.length === 0) this.#releaseIdle()
  }

  async #attempt(
    ctx: MemoryPiContext,
    records: SessionRecord[],
    range: ChunkRange,
    cancel: AbortSignal,
  ): Promise<string[]> {
    try {
      const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return [OBSERVER_UNEXPECTED]
      const signal = AbortSignal.any([operation.signal, cancel])
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
    tell(ctx, notice, "warning")
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

  #releaseIdle(): void {
    const waiting = this.#idle
    this.#idle = []
    for (const release of waiting) release()
  }
}

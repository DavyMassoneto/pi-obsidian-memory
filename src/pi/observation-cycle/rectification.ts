import type { MemoryPiContext } from "#src/pi/context"
import {
  attributionChecks,
  CHARS_PER_TOKEN,
  type CycleSettings,
  exhaustedRectifications,
  extractUserWords,
  nowMs,
  OBSERVER_RETRY_MS,
  type ObservationsRectified,
  RECTIFY_FAILED_TYPE,
  repairAttribution,
  repairChecks,
  type SessionRecord,
  USER_WORDS_TYPE,
  userWordsChecks,
  verifyAttribution,
  wholeUserWords,
} from "#src/usecases"
import { OBSERVER_RETRY_NOTICE, OBSERVER_UNEXPECTED, RECTIFICATION_FAILED } from "./constants.ts"
import { type NoticeQueue, rectificationOutcomeNotice, tell, uncheckedNotice } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { AfterVerified, CancelSignal, ObservationCycleDeps, RectificationJob } from "./types.ts"

export class Rectification {
  #deps: ObservationCycleDeps
  #cancel: CancelSignal
  #notices: NoticeQueue
  #running: Promise<void> | null = null
  #failedAtMs: number | null = null
  #told = new Set<string>()
  #afterVerified: AfterVerified

  constructor(deps: ObservationCycleDeps, cancel: CancelSignal, notices: NoticeQueue, afterVerified: AfterVerified) {
    this.#deps = deps
    this.#cancel = cancel
    this.#notices = notices
    this.#afterVerified = afterVerified
  }

  reset(): void {
    this.#running = null
    this.#failedAtMs = null
    this.#told = new Set<string>()
  }

  run(ctx: MemoryPiContext, settings: CycleSettings): Promise<void> {
    if (this.#running) return this.#running
    if (!this.#retryDue()) return Promise.resolve()
    if (this.#pending(ctx, settings.observer).length === 0) return Promise.resolve()
    const running = this.#verifyAll(ctx, settings).finally(() => {
      if (this.#running === running) this.#running = null
    })
    this.#running = running
    return running
  }

  async runUntil(ctx: MemoryPiContext, settings: CycleSettings, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return
    const aborted = Promise.withResolvers<void>()
    const release = () => aborted.resolve()
    signal.addEventListener("abort", release, { once: true })
    await Promise.race([this.run(ctx, settings), aborted.promise])
    signal.removeEventListener("abort", release)
  }

  #pending(ctx: MemoryPiContext, observer: CycleSettings["observer"]): RectificationJob[] {
    const records = recordsOf(ctx.sessionManager.getBranch())
    for (const closed of exhaustedRectifications(records)) {
      this.#deps.appendRectified(closed)
      this.#notices.add(ctx, uncheckedNotice(closed.observations.length))
    }
    for (const words of wholeUserWords(records)) this.#deps.appendCompanion({ type: USER_WORDS_TYPE, data: words })
    const checks = attributionChecks(recordsOf(ctx.sessionManager.getBranch()), observer.chunkTokens * CHARS_PER_TOKEN)
    const words = this.#userWordsJobs(ctx)
    if (checks.length > 0) {
      const verifications: RectificationJob[] = checks.map((check) => ({
        recordId: check.recordId,
        work: async (context, complete) => this.#rectified(ctx, await verifyAttribution({ check }, context, complete)),
      }))
      return [...verifications, ...words]
    }
    return [...this.#repairJobs(ctx, records), ...words]
  }

  #userWordsJobs(ctx: MemoryPiContext): RectificationJob[] {
    return userWordsChecks(recordsOf(ctx.sessionManager.getBranch())).map((check) => ({
      recordId: check.entryId,
      work: async (context, complete) => {
        const words = await extractUserWords(check, context, complete)
        if (!words.succeeded) return words.problems
        this.#deps.appendCompanion({ type: USER_WORDS_TYPE, data: words.output })
        return []
      },
    }))
  }

  #repairJobs(ctx: MemoryPiContext, records: SessionRecord[]): RectificationJob[] {
    return repairChecks(records).map((repair) => ({
      recordId: null,
      work: async (context, complete) =>
        this.#rectified(ctx, await repairAttribution({ records, ...repair }, context, complete)),
    }))
  }

  #rectified(ctx: MemoryPiContext, result: Awaited<ReturnType<typeof verifyAttribution>>): string[] {
    if (!result.succeeded) return result.problems
    this.#append(ctx, result.output)
    return []
  }

  async #verifyAll(ctx: MemoryPiContext, settings: CycleSettings): Promise<void> {
    const { observer } = settings
    const cancel = this.#cancel()
    for (;;) {
      const jobs = this.#pending(ctx, observer)
      if (jobs.length === 0) break
      const settled = await this.#verify(ctx, jobs, observer.concurrency)
      if (!settled || cancel.aborted) return
    }
    this.#afterVerified(ctx, settings)
  }

  #retryDue(): boolean {
    if (typeof this.#failedAtMs !== "number") return true
    return nowMs() - this.#failedAtMs >= OBSERVER_RETRY_MS
  }

  async #verify(ctx: MemoryPiContext, jobs: RectificationJob[], concurrency: number): Promise<boolean> {
    const cancel = this.#cancel()
    const problems: string[] = []
    for (let start = 0; start < jobs.length && problems.length === 0; start += concurrency) {
      const batch = jobs.slice(start, start + concurrency)
      const results = await Promise.all(batch.map((job) => this.#attempt(ctx, job, cancel)))
      if (cancel.aborted) return false
      problems.push(...results.flat())
    }
    if (problems.length === 0) {
      this.#failedAtMs = null
      return true
    }
    this.#failedAtMs = nowMs()
    const notice = `${RECTIFICATION_FAILED} ${problems.join("; ")}. ${OBSERVER_RETRY_NOTICE}`
    if (this.#told.has(notice)) return false
    this.#told.add(notice)
    tell(ctx, notice, "warning")
    return false
  }

  async #attempt(ctx: MemoryPiContext, job: RectificationJob, cancel: AbortSignal): Promise<string[]> {
    const problems = await this.#worked(ctx, job, cancel)
    if (cancel.aborted || problems.length === 0 || typeof job.recordId !== "string") return problems
    this.#deps.appendCompanion({
      type: RECTIFY_FAILED_TYPE,
      data: { recordId: job.recordId, problem: problems.join("; ") },
    })
    return problems
  }

  async #worked(ctx: MemoryPiContext, job: RectificationJob, cancel: AbortSignal): Promise<string[]> {
    try {
      const operation = this.#deps.sessions.cycleOperation(ctx, this.#deps.paths)
      if (!operation) return [OBSERVER_UNEXPECTED]
      const signal = AbortSignal.any([operation.signal, cancel])
      const problems = await job.work({ ...operation, signal }, this.#deps.completionOf(ctx))
      if (cancel.aborted) return []
      return problems
    } catch (error) {
      if (error instanceof Error) return [error.message]
      return [OBSERVER_UNEXPECTED]
    }
  }

  #append(ctx: MemoryPiContext, data: ObservationsRectified): void {
    this.#deps.appendRectified(data)
    const notice = rectificationOutcomeNotice(data.observations)
    if (notice.length > 0) this.#notices.add(ctx, notice)
  }
}

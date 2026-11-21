import type { ChatModelSource, MemoryPiContext } from "#src/pi/context"
import { confirmedSourceIds, observeHistory, planObservationSlices } from "#src/usecases"
import { OBSERVATION_FAILED } from "./constants.ts"
import { observationCommits, observationSources } from "./session.ts"
import type {
  ObservationDispatch,
  ObservationJob,
  ObservationRun,
  ObservationRuntimeDeps,
  ObservationRuntimeSettings,
} from "./types.ts"

export class ObservationRuntime {
  #deps: ObservationRuntimeDeps
  #jobs = new Map<symbol, ObservationJob>()
  #generation = 0
  #closed = false
  #problems: string[] = []

  constructor(deps: ObservationRuntimeDeps) {
    this.#deps = deps
  }

  get problems(): string[] {
    return [...this.#problems]
  }

  observe(ctx: MemoryPiContext, model: ChatModelSource, settings: ObservationRuntimeSettings): void {
    this.#dispatch({ ctx, model, settings, flush: false, attemptedIds: [] })
  }

  async flush(ctx: MemoryPiContext, model: ChatModelSource, settings: ObservationRuntimeSettings): Promise<void> {
    await this.settled()
    const attempted = new Set<string>()
    while (!this.#closed) {
      const ids = this.#dispatch({ ctx, model, settings, flush: true, attemptedIds: [...attempted] })
      if (ids.length === 0) return
      for (const id of ids) attempted.add(id)
      await this.settled()
    }
  }

  async settled(): Promise<void> {
    await Promise.all([...this.#jobs.values()].map((job) => job.promise))
  }

  reset(): void {
    this.#generation += 1
    for (const job of this.#jobs.values()) job.controller.abort()
    this.#jobs.clear()
    this.#closed = false
    this.#problems = []
  }

  async close(): Promise<void> {
    this.#closed = true
    this.#generation += 1
    for (const job of this.#jobs.values()) job.controller.abort()
    await this.settled()
    this.#jobs.clear()
  }

  #dispatch({ ctx, model, settings, flush, attemptedIds }: ObservationDispatch): string[] {
    if (this.#closed) return []
    const branch = ctx.sessionManager.getBranch()
    const anchor = branch.at(-1)
    if (!anchor) return []
    const sources = observationSources(branch)
    const confirmed = confirmedSourceIds(sources, observationCommits(branch))
    const reserved = [...this.#jobs.values()].flatMap((job) => job.sourceIds)
    const limits = { ...settings, maxSlices: settings.observerConcurrency - this.#jobs.size }
    const slices = planObservationSlices(sources, confirmed, [...reserved, ...attemptedIds], limits, flush)
    for (const slice of slices) {
      const id = Symbol()
      const controller = new AbortController()
      const request = {
        ctx,
        model,
        sessionId: ctx.sessionManager.getSessionId(),
        anchorId: anchor.id,
        generation: this.#generation,
        slice,
        signal: controller.signal,
      }
      const promise = this.#run(request).finally(() => this.#jobs.delete(id))
      this.#jobs.set(id, { sourceIds: slice.entries.map((entry) => entry.id), controller, promise })
    }
    return slices.flatMap((slice) => slice.entries.map((entry) => entry.id))
  }

  async #run(request: ObservationRun): Promise<void> {
    try {
      const { ctx, model, signal, slice } = request
      const result = await observeHistory({ ...slice, model, signal }, this.#deps.completionOf(ctx))
      if (!this.#isCurrent(request)) return
      if (!result.succeeded) return this.#report(ctx, result.problems)
      this.#deps.writeCommit(result.output)
    } catch (error) {
      if (!this.#isCurrent(request)) return
      if (error instanceof Error) this.#report(request.ctx, [error.message])
      else this.#report(request.ctx, ["Unexpected observation failure"])
    }
  }

  #isCurrent(request: ObservationRun): boolean {
    if (this.#closed || request.signal.aborted || request.generation !== this.#generation) return false
    if (request.ctx.sessionManager.getSessionId() !== request.sessionId) return false
    const branchIds = new Set(request.ctx.sessionManager.getBranch().map((entry) => entry.id))
    return branchIds.has(request.anchorId) && request.slice.entries.every((entry) => branchIds.has(entry.id))
  }

  #report(ctx: MemoryPiContext, problems: string[]): void {
    this.#problems.push(...problems)
    if (ctx.hasUI) ctx.ui.notify(`${OBSERVATION_FAILED} ${problems.join("; ")}`, "warning")
  }
}

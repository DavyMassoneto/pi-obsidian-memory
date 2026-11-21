import type { MemoryPiContext } from "#src/pi/context"
import { STATUS_CONSOLIDATING } from "#src/pi/context"
import {
  type ConsolidatedSession,
  type CycleSettings,
  consolidatedData,
  consolidateSession,
  type LedgerObservation,
  ledgerOf,
  nowMs,
  OBSERVER_RETRY_MS,
  poolTokens,
  savedNotesIn,
  selectPromotion,
} from "#src/usecases"
import { CONSOLIDATION_FAILED, CONSOLIDATION_SAVED, OBSERVER_RETRY_NOTICE, OBSERVER_UNEXPECTED } from "./constants.ts"
import { tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { CancelSignal, ObservationCycleDeps, Promotion } from "./types.ts"

export class Consolidation {
  #deps: ObservationCycleDeps
  #cancel: CancelSignal
  #running = false
  #failedAtMs: number | null = null
  #told = new Set<string>()

  constructor(deps: ObservationCycleDeps, cancel: CancelSignal) {
    this.#deps = deps
    this.#cancel = cancel
  }

  reset(): void {
    this.#running = false
    this.#failedAtMs = null
    this.#told = new Set<string>()
  }

  start(ctx: MemoryPiContext, settings: CycleSettings): void {
    if (this.#running || !this.#retryDue()) return
    const records = recordsOf(ctx.sessionManager.getBranch())
    const ledger = ledgerOf(records)
    const { atPoolTokens, poolTargetTokens } = settings.consolidator
    if (poolTokens(ledger) < atPoolTokens) return
    const promoted = selectPromotion(ledger, poolTargetTokens)
    if (promoted.length === 0) return
    this.#running = true
    this.#showStatus(ctx, true)
    void this.#run(ctx, { records, ledger, promoted })
  }

  #retryDue(): boolean {
    if (typeof this.#failedAtMs !== "number") return true
    return nowMs() - this.#failedAtMs >= OBSERVER_RETRY_MS
  }

  async #run(ctx: MemoryPiContext, promotion: Promotion): Promise<void> {
    const cancel = this.#cancel()
    const problems = await this.#attempt(ctx, promotion, cancel)
    if (cancel.aborted) return
    this.#running = false
    this.#showStatus(ctx, false)
    if (problems.length === 0) {
      this.#failedAtMs = null
      return
    }
    this.#failedAtMs = nowMs()
    const notice = `${CONSOLIDATION_FAILED} ${problems.join("; ")}. ${OBSERVER_RETRY_NOTICE}`
    if (this.#told.has(notice)) return
    this.#told.add(notice)
    tell(ctx, notice, "warning")
  }

  async #attempt(ctx: MemoryPiContext, promotion: Promotion, cancel: AbortSignal): Promise<string[]> {
    const { records, ledger, promoted } = promotion
    try {
      const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return [OBSERVER_UNEXPECTED]
      const signal = AbortSignal.any([operation.signal, cancel])
      const ids = promoted.map((observation) => observation.id)
      const request = { observations: promoted, journey: ledger.journey, saved: savedNotesIn(records, ledger, ids) }
      const result = await consolidateSession(request, { ...operation, signal }, this.#deps.completionOf(ctx))
      if (!result.succeeded) return result.problems
      this.#commit(ctx, promoted, result.output)
      return []
    } catch (error) {
      if (error instanceof Error) return [error.message]
      return [OBSERVER_UNEXPECTED]
    }
  }

  #commit(ctx: MemoryPiContext, promoted: LedgerObservation[], consolidated: ConsolidatedSession): void {
    const ledger = ledgerOf(recordsOf(ctx.sessionManager.getBranch()))
    const data = consolidatedData(promoted, ledger, consolidated.journey)
    if (data) this.#deps.appendConsolidated(data)
    const changes = consolidated.applied.filter((write) => write.status === "applied").length
    if (changes > 0) tell(ctx, `${CONSOLIDATION_SAVED} ${changes} change(s) to the vaults.`, "info")
  }

  #showStatus(ctx: MemoryPiContext, active: boolean): void {
    if (!ctx.hasUI) return
    let text: string | undefined
    if (active) text = STATUS_CONSOLIDATING.text
    try {
      ctx.ui.setStatus(STATUS_CONSOLIDATING.key, text)
    } catch {
      return
    }
  }
}

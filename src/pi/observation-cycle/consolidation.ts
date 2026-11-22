import type { MemoryPiContext } from "#src/pi/context"
import { STATUS_CONSOLIDATING } from "#src/pi/context"
import {
  type AppliedWrite,
  awaitsVerification,
  CONSOLIDATION_META_TYPE,
  type ConsolidatedSession,
  type CycleSettings,
  consolidatedData,
  consolidateSession,
  type Ledger,
  type LedgerObservation,
  ledgerOf,
  NOTE_WRITTEN_TYPE,
  nowMs,
  OBSERVER_RETRY_MS,
  pendingWrittenNotes,
  poolTokens,
  savedNotesIn,
  selectPromotion,
  writtenNote,
} from "#src/usecases"
import { CONSOLIDATION_FAILED, OBSERVER_RETRY_NOTICE, OBSERVER_UNEXPECTED } from "./constants.ts"
import { consolidatedNotice, consolidatorStartedNotice, type NoticeQueue, tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { CancelSignal, ObservationCycleDeps, Promotion } from "./types.ts"

function tokensOf(observations: LedgerObservation[]): number {
  let total = 0
  for (const observation of observations) total += observation.tokens
  return total
}

function promotionOf(ledger: Ledger, atPoolTokens: number, poolTargetTokens: number): LedgerObservation[] {
  if (poolTokens(ledger) < atPoolTokens) return []
  const promoted = selectPromotion(ledger, poolTargetTokens)
  if (awaitsVerification(promoted)) return []
  return promoted
}

export class Consolidation {
  #deps: ObservationCycleDeps
  #cancel: CancelSignal
  #running = false
  #failedAtMs: number | null = null
  #told = new Set<string>()
  #notices: NoticeQueue

  constructor(deps: ObservationCycleDeps, cancel: CancelSignal, notices: NoticeQueue) {
    this.#deps = deps
    this.#cancel = cancel
    this.#notices = notices
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
    const promoted = promotionOf(ledger, atPoolTokens, poolTargetTokens)
    if (promoted.length === 0 && ledger.corrections.length === 0) return
    this.#running = true
    this.#showStatus(ctx, true)
    const notice = consolidatorStartedNotice(promoted.length, tokensOf(promoted), ledger.corrections.length)
    tell(ctx, notice, "info")
    void this.#run(ctx, { records, ledger, promoted, corrections: ledger.corrections })
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
    const { records, ledger, promoted, corrections } = promotion
    try {
      const operation = this.#deps.sessions.cycleOperation(ctx.cwd, this.#deps.paths)
      if (!operation) return [OBSERVER_UNEXPECTED]
      const signal = AbortSignal.any([operation.signal, cancel])
      const ids = promoted.map((observation) => observation.id)
      const batchIds = [...ids, ...corrections.map((observation) => observation.id)]
      const request = {
        observations: promoted,
        corrections,
        correctionNotes: ledger.correctionNotes,
        journey: ledger.journey,
        saved: savedNotesIn(records, ledger, ids),
        owedNotes: pendingWrittenNotes(records, batchIds),
        onApplied: (write: AppliedWrite) => this.#noteWritten(batchIds, write),
      }
      const result = await consolidateSession(request, { ...operation, signal }, this.#deps.completionOf(ctx))
      if (!result.succeeded) return result.problems
      this.#commit(ctx, promotion, result.output)
      return []
    } catch (error) {
      if (error instanceof Error) return [error.message]
      return [OBSERVER_UNEXPECTED]
    }
  }

  #commit(ctx: MemoryPiContext, promotion: Promotion, consolidated: ConsolidatedSession): void {
    const { promoted, corrections } = promotion
    const ledger = ledgerOf(recordsOf(ctx.sessionManager.getBranch()))
    const told = [...promoted, ...corrections]
    const written = consolidatedData(promoted, ledger, consolidated.journey, told, consolidated.notes)
    if (written.consolidated) this.#deps.appendConsolidated(written.consolidated)
    if (written.meta) this.#deps.appendCompanion({ type: CONSOLIDATION_META_TYPE, data: written.meta })
    const changes = consolidated.applied.filter((write) => write.status === "applied").length
    this.#notices.add(ctx, consolidatedNotice(promoted.length, changes))
  }

  #noteWritten(observationIds: string[], write: AppliedWrite): void {
    const note = writtenNote(write)
    if (note) this.#deps.appendCompanion({ type: NOTE_WRITTEN_TYPE, data: { observationIds, ...note } })
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

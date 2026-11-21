import type { MemoryPiContext } from "#src/pi/context"
import { compactionRetryDue, rawTokensSinceLastCompaction, type SessionRecord } from "#src/usecases"
import { COMPACTION_CANCELLED, COMPACTION_NOT_DONE, RUN_GOES_ON } from "./constants.ts"
import { tell } from "./notice.ts"
import { recordsOf } from "./records.ts"
import type { SendResume } from "./types.ts"

export class CompactionTrigger {
  #sendResume: SendResume
  #running = false
  #failedAtTokens: number | null = null

  constructor(sendResume: SendResume) {
    this.#sendResume = sendResume
  }

  get running(): boolean {
    return this.#running
  }

  reset(): void {
    this.#running = false
    this.#failedAtTokens = null
  }

  retryDue(records: SessionRecord[], chunkTokens: number): boolean {
    if (typeof this.#failedAtTokens !== "number") return true
    return compactionRetryDue(this.#failedAtTokens, rawTokensSinceLastCompaction(records), chunkTokens)
  }

  run(ctx: MemoryPiContext, resume: boolean): void {
    const attemptedAtTokens = rawTokensSinceLastCompaction(recordsOf(ctx.sessionManager.getBranch()))
    this.#running = true
    ctx.compact({
      onComplete: () => {
        this.#running = false
        this.#failedAtTokens = null
        if (resume) this.#resume()
      },
      onError: (error) => {
        this.#running = false
        if (error.message === COMPACTION_CANCELLED) return
        this.#failedAtTokens = attemptedAtTokens
        if (resume) {
          tell(ctx, `${COMPACTION_NOT_DONE} ${error.message}. ${RUN_GOES_ON}`, "warning")
          this.#resume()
          return
        }
        tell(ctx, `${COMPACTION_NOT_DONE} ${error.message}`, "warning")
      },
    })
  }

  #resume(): void {
    try {
      this.#sendResume()
    } catch {
      return
    }
  }
}

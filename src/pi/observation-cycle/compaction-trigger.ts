import type { MemoryPiContext } from "#src/pi/context"
import { compactionRetryDue, rawTokensSinceLastCompaction, type SessionRecord } from "#src/usecases"
import { COMPACTION_CANCELLED, COMPACTION_FAILED } from "./constants.ts"
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
        tell(ctx, `${COMPACTION_FAILED} ${error.message}`, "warning")
        if (resume) this.#resume()
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

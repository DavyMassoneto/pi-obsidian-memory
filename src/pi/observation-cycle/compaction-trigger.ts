import type { CompactionEntryDraft, SessionEntry } from "@earendil-works/pi-coding-agent"

import { compactionRetryDue, rawTokensSinceLastCompaction, type SessionRecord } from "#src/usecases"
import type { CompactionAttempt, CompactionBuild } from "./types.ts"

export class CompactionTrigger {
  #active: AbortSignal | null = null
  #failedAtTokens: number | null = null
  #pending: CompactionAttempt | null = null

  get running(): boolean {
    return this.#active instanceof AbortSignal
  }

  reset(): void {
    this.#active = null
    this.#failedAtTokens = null
    this.#pending = null
  }

  confirm(branch: SessionEntry[]): boolean {
    const pending = this.#pending
    if (!pending) return false
    this.#pending = null
    const after = branch.findIndex((entry) => entry.id === pending.afterId)
    if (after < 0) return false
    const { draft } = pending
    const committed = branch
      .slice(after + 1)
      .some(
        (entry) =>
          entry.type === "compaction" &&
          entry.fromHook &&
          entry.firstKeptEntryId === draft.firstKeptEntryId &&
          entry.summary === draft.summary,
      )
    if (committed) this.#failedAtTokens = null
    return committed
  }

  retryDue(records: SessionRecord[], chunkTokens: number): boolean {
    if (typeof this.#failedAtTokens !== "number") return true
    return compactionRetryDue(this.#failedAtTokens, rawTokensSinceLastCompaction(records), chunkTokens)
  }

  async attempt(
    records: SessionRecord[],
    afterId: string,
    signal: AbortSignal,
    build: CompactionBuild,
  ): Promise<CompactionEntryDraft | null> {
    const attemptedAtTokens = rawTokensSinceLastCompaction(records)
    this.#active = signal
    try {
      const draft = await build()
      if (signal.aborted) return null
      this.#failedAtTokens = attemptedAtTokens
      if (draft) this.#pending = { afterId, draft }
      return draft
    } finally {
      if (this.#active === signal) this.#active = null
    }
  }
}

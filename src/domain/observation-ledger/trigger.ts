import { RETRYABLE_ERROR } from "./constants.ts"
import { rawTokensSinceLastCompaction } from "./cutoff.ts"
import type { CompactionDueRequest } from "./types.ts"

export function compactionDue(request: CompactionDueRequest): boolean {
  const raw = rawTokensSinceLastCompaction(request.records)
  let tokens = raw
  if (typeof request.contextTokens === "number") tokens = request.contextTokens
  return tokens >= request.atContextTokens && raw - request.tailTokens >= request.chunkTokens
}

export function retriedByPi(stopReason: string, errorMessage: string | null): boolean {
  if (stopReason !== "error" || !errorMessage) return false
  return RETRYABLE_ERROR.test(errorMessage)
}

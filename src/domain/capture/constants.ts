import type { CaptureTally } from "./types.ts"

export const MIN_USER_MESSAGES_BEFORE_REVIEW = 3

export const EMPTY_TALLY: CaptureTally = { userMessages: 0, turnsSinceReview: 0, toolCallsSinceReview: 0 }

export const SCOPE_REASON_REQUIRED =
  "scopeReason is required for add, update and succeed: one sentence saying why this vault (global or project) fits the note's content"

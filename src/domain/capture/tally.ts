import { MIN_USER_MESSAGES_BEFORE_REVIEW } from "./constants.ts"
import type { CaptureCadenceSettings, CaptureTally, FinishedTurn, FlushMoment, TurnOutcome } from "./types.ts"

export function tallyUserMessage(tally: CaptureTally): CaptureTally {
  return { ...tally, userMessages: tally.userMessages + 1 }
}

export function tallyTurn(
  tally: CaptureTally,
  turn: FinishedTurn,
  settings: CaptureCadenceSettings | null,
): TurnOutcome {
  const counted = { ...tally, turnsSinceReview: tally.turnsSinceReview + 1 }
  if (!settings?.reviewEnabled || turn.reviewActive) return { tally: counted, review: false }
  counted.toolCallsSinceReview += turn.toolCalls
  const reached =
    counted.turnsSinceReview >= settings.nudgeInterval || counted.toolCallsSinceReview >= settings.nudgeToolCalls
  if (!reached || counted.userMessages < MIN_USER_MESSAGES_BEFORE_REVIEW) return { tally: counted, review: false }
  return { tally: { ...counted, turnsSinceReview: 0, toolCallsSinceReview: 0 }, review: true }
}

export function shouldFlush(tally: CaptureTally, settings: CaptureCadenceSettings, moment: FlushMoment): boolean {
  if (tally.userMessages < settings.flushMinTurns) return false
  if (moment === "compact") return settings.flushOnCompact
  return settings.flushOnShutdown
}

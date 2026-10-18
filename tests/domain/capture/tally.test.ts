import { describe, expect, it } from "vitest"

import { shouldFlush, tallyTurn, tallyUserMessage } from "#src/domain"
import { afterUserMessages, runTurns, tallySettings as settings } from "#test-helpers"

describe("tallyTurn", () => {
  it("does not review before the turn interval is reached", () => {
    expect(runTurns(afterUserMessages(3), 2, 0).reviews).toBe(0)
  })

  it("reviews on the turn that reaches the interval and starts counting again", () => {
    const first = runTurns(afterUserMessages(3), 3, 0)
    expect(first.reviews).toBe(1)
    expect(first.tally).toEqual({ ...afterUserMessages(3), turnsSinceReview: 0, toolCallsSinceReview: 0 })
    expect(runTurns(first.tally, 2, 0).reviews).toBe(0)
    expect(runTurns(first.tally, 3, 0).reviews).toBe(1)
  })

  it("reviews when the tool calls reach their threshold before the turns do", () => {
    expect(runTurns(afterUserMessages(3), 1, 4).reviews).toBe(0)
    expect(runTurns(afterUserMessages(3), 2, 3).reviews).toBe(1)
  })

  it("never reviews before the third user message, and keeps counting", () => {
    const early = runTurns(afterUserMessages(2), 4, 0)
    expect(early.reviews).toBe(0)
    expect(early.tally.turnsSinceReview).toBe(4)
    expect(tallyTurn(early.tally, { toolCalls: 0, reviewActive: false }, settings).review).toBe(false)
    const third = tallyUserMessage(early.tally)
    expect(tallyTurn(third, { toolCalls: 0, reviewActive: false }, settings).review).toBe(true)
  })

  it("counts the turn but not its tool calls while a review is running, and asks for no review", () => {
    const outcome = tallyTurn(afterUserMessages(3), { toolCalls: 9, reviewActive: true }, settings)
    expect(outcome).toEqual({
      tally: { ...afterUserMessages(3), turnsSinceReview: 1, toolCallsSinceReview: 0 },
      review: false,
    })
  })

  it("counts the turn but never reviews and ignores the tool calls when there are no settings", () => {
    const outcome = tallyTurn(afterUserMessages(3), { toolCalls: 9, reviewActive: false }, null)
    expect(outcome).toEqual({
      tally: { ...afterUserMessages(3), turnsSinceReview: 1, toolCallsSinceReview: 0 },
      review: false,
    })
  })

  it("counts the turn but never reviews when reviews are turned off", () => {
    const off = { ...settings, reviewEnabled: false }
    const outcome = tallyTurn(
      { ...afterUserMessages(3), turnsSinceReview: 20 },
      { toolCalls: 99, reviewActive: false },
      off,
    )
    expect(outcome).toEqual({
      tally: { ...afterUserMessages(3), turnsSinceReview: 21, toolCallsSinceReview: 0 },
      review: false,
    })
  })
})

describe("shouldFlush", () => {
  it("flushes at compaction and at shutdown once the user messages reach the minimum", () => {
    expect(shouldFlush(afterUserMessages(4), settings, "compact")).toBe(true)
    expect(shouldFlush(afterUserMessages(4), settings, "shutdown")).toBe(true)
  })

  it("does not flush below the minimum", () => {
    expect(shouldFlush(afterUserMessages(3), settings, "compact")).toBe(false)
    expect(shouldFlush(afterUserMessages(3), settings, "shutdown")).toBe(false)
  })

  it("is not reset by reviews", () => {
    const reviewed = runTurns(afterUserMessages(4), 3, 0)
    expect(reviewed.reviews).toBe(1)
    expect(shouldFlush(reviewed.tally, settings, "shutdown")).toBe(true)
  })

  it("follows the switch of each moment", () => {
    const compactOff = { ...settings, flushOnCompact: false }
    const shutdownOff = { ...settings, flushOnShutdown: false }
    expect(shouldFlush(afterUserMessages(4), compactOff, "compact")).toBe(false)
    expect(shouldFlush(afterUserMessages(4), compactOff, "shutdown")).toBe(true)
    expect(shouldFlush(afterUserMessages(4), shutdownOff, "shutdown")).toBe(false)
    expect(shouldFlush(afterUserMessages(4), shutdownOff, "compact")).toBe(true)
  })
})

import { describe, expect, it } from "vitest"

import { OBSERVER_RETRY_MS, planObserverChunks, retryDue } from "#src/domain"
import {
  assistantRecord,
  chunkPlan,
  chunkRange,
  conversation,
  observationsRecord,
  toolResultRecord,
  userRecord,
} from "#test-helpers"

describe("planObserverChunks", () => {
  it("10-token entries with a chunk of 25 make a slice of two entries", () => {
    const records = conversation(8, 10)

    expect(planObserverChunks(chunkPlan(records, {}))).toEqual([
      chunkRange("r1", "r2"),
      chunkRange("r3", "r4"),
      chunkRange("r5", "r6"),
    ])
  })

  it("a tool result past the budget stays with its assistant entry", () => {
    const records = [
      assistantRecord("asst-1", "call", 10),
      toolResultRecord("tr-1", "read", "text", 10),
      userRecord("raw-2", "two", 10),
      userRecord("raw-3", "three", 10),
      userRecord("raw-4", "four", 10),
    ]

    expect(planObserverChunks(chunkPlan(records, { chunkTokens: 15 }))).toEqual([
      chunkRange("asst-1", "tr-1"),
      chunkRange("raw-2", "raw-2"),
      chunkRange("raw-3", "raw-3"),
    ])
  })

  it("the open span is planned while a full chunk of tokens remains from the slice start, and the remainder waits", () => {
    const records = conversation(5, 10)

    expect(planObserverChunks(chunkPlan(records, {}))).toEqual([chunkRange("r1", "r2"), chunkRange("r3", "r4")])
    expect(planObserverChunks(chunkPlan(conversation(2, 10), {}))).toEqual([])
  })

  it("a closed span is planned in every slice", () => {
    const records = [...conversation(5, 10), observationsRecord("o1", "r5", "r5", [])]

    expect(planObserverChunks(chunkPlan(records, {}))).toEqual([chunkRange("r1", "r2"), chunkRange("r3", "r4")])
    expect(
      planObserverChunks(chunkPlan([...conversation(3, 10), observationsRecord("o1", "r3", "r3", [])], {})),
    ).toEqual([chunkRange("r1", "r2")])
  })

  it("no more chunks than free slots are planned", () => {
    const records = conversation(8, 10)
    const inFlight = [chunkRange("r7", "r8")]

    expect(planObserverChunks(chunkPlan(records, { concurrency: 2, inFlight }))).toEqual([chunkRange("r1", "r2")])
    expect(planObserverChunks(chunkPlan(records, { concurrency: 1, inFlight }))).toEqual([])
  })

  it("a failed span waits for the retry delay and is planned again after it", () => {
    const records = conversation(8, 10)
    const failed = [{ fromId: "r1", failedAtMs: 1000 }]

    expect(planObserverChunks(chunkPlan(records, { failed, nowMs: 1000 + OBSERVER_RETRY_MS - 1 }))).toEqual([])
    expect(planObserverChunks(chunkPlan(records, { failed, nowMs: 1000 + OBSERVER_RETRY_MS }))).toEqual([
      chunkRange("r1", "r2"),
      chunkRange("r3", "r4"),
      chunkRange("r5", "r6"),
    ])
  })

  it("before a cut, only entries before it are planned, partial slices included, and attempted spans are skipped", () => {
    const records = conversation(6, 10)
    const failed = [{ fromId: "r1", failedAtMs: 1000 }]

    expect(planObserverChunks(chunkPlan(records, { until: "r4" }))).toEqual([
      chunkRange("r1", "r2"),
      chunkRange("r3", "r3"),
    ])
    expect(planObserverChunks(chunkPlan(records, { until: "r4", failed, nowMs: 1001 }))).toEqual([
      chunkRange("r1", "r2"),
      chunkRange("r3", "r3"),
    ])
    expect(planObserverChunks(chunkPlan(records, { until: "r4", attempted: ["r1"] }))).toEqual([])

    const split = [...records, observationsRecord("o1", "r3", "r3", [])]
    expect(planObserverChunks(chunkPlan(split, { until: "r6", attempted: ["r1"] }))).toEqual([chunkRange("r4", "r5")])
  })
})

describe("retryDue", () => {
  it("a failure is due once the retry delay has passed", () => {
    const failure = { fromId: "r1", failedAtMs: 1000 }

    expect(retryDue(failure, 1000 + OBSERVER_RETRY_MS - 1)).toBe(false)
    expect(retryDue(failure, 1000 + OBSERVER_RETRY_MS)).toBe(true)
  })
})

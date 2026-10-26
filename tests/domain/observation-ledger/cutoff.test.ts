import { describe, expect, it } from "vitest"

import { idealCutId, ledgerOf, rawTokensSinceLastCompaction, snapCutoff } from "#src/domain"
import {
  assistantRecord,
  compactionRecord,
  conversation,
  observation,
  observationsRecord,
  observedAfterTwoAndFour,
  toolResultRecord,
  turn,
  userRecord,
} from "#test-helpers"

const seen = observation("2026-10-26T13:35:00", "seen")

describe("snapCutoff", () => {
  it("with boundaries after raw-2 and raw-4 and 10 tokens each, a tail target of 25 keeps from raw-5 and 40 keeps from raw-3", () => {
    const records = observedAfterTwoAndFour(seen)
    const ledger = ledgerOf(records)

    expect(snapCutoff(records, ledger, 25)).toEqual({ firstKeptEntryId: "r5", firstKeptIndex: 6, tail: 20 })
    expect(snapCutoff(records, ledger, 40)).toEqual({ firstKeptEntryId: "r3", firstKeptIndex: 3, tail: 40 })
  })

  it("a tie between two boundaries goes to the earlier one", () => {
    const records = observedAfterTwoAndFour(seen)

    expect(snapCutoff(records, ledgerOf(records), 30)).toEqual({ firstKeptEntryId: "r3", firstKeptIndex: 3, tail: 40 })
  })

  it("a boundary with an unobserved entry before it is not a candidate", () => {
    const records = [
      turn(1, 10),
      turn(2, 10),
      turn(3, 10),
      turn(4, 10),
      observationsRecord("o1", "r3", "r4", [seen]),
      turn(5, 10),
      turn(6, 10),
    ]

    expect(snapCutoff(records, ledgerOf(records), 20)).toBeNull()
  })

  it("a boundary followed by a tool result is not a candidate", () => {
    const records = [
      userRecord("u1", "run it", 10),
      assistantRecord("a1", "calling", 10),
      observationsRecord("o1", "u1", "a1", [seen]),
      toolResultRecord("t1", "bash", "output", 10),
      assistantRecord("a2", "done", 10),
    ]

    expect(snapCutoff(records, ledgerOf(records), 20)).toBeNull()
  })

  it("with no observed prefix there is no cut", () => {
    const records = conversation(6, 10)

    expect(snapCutoff(records, ledgerOf(records), 20)).toBeNull()
  })

  it("a boundary at the last source entry has nothing to keep and is not a candidate", () => {
    const records = [turn(1, 10), turn(2, 10), observationsRecord("o1", "r1", "r2", [seen])]

    expect(snapCutoff(records, ledgerOf(records), 10)).toBeNull()
  })
})

describe("idealCutId", () => {
  it("the ideal cut is the first cut point from the end whose tail reaches the target, and none when nothing precedes it", () => {
    const records = conversation(5, 10)

    expect(idealCutId(records, 25)).toBe("r3")
    expect(idealCutId(records, 20)).toBe("r4")
    expect(idealCutId(records, 50)).toBeNull()
    expect(idealCutId(records, 100)).toBeNull()
  })

  it("a tool result is counted in the tail but never chosen as the cut", () => {
    const records = [
      userRecord("u1", "run it", 10),
      assistantRecord("a1", "calling", 10),
      toolResultRecord("t1", "bash", "output", 10),
      assistantRecord("a2", "done", 10),
    ]

    expect(idealCutId(records, 20)).toBe("a1")
  })
})

describe("rawTokensSinceLastCompaction", () => {
  it("raw tokens count from the first kept entry of the last compaction, or all entries when there is none", () => {
    const withCompaction = [
      turn(1, 10),
      turn(2, 10),
      turn(3, 10),
      turn(4, 10),
      compactionRecord("c1", "r3"),
      turn(5, 10),
    ]

    expect(rawTokensSinceLastCompaction(conversation(3, 10))).toBe(30)
    expect(rawTokensSinceLastCompaction(withCompaction)).toBe(30)
  })

  it("when the first kept entry is not on the branch the count starts after the compaction entry", () => {
    const records = [turn(1, 10), turn(2, 10), compactionRecord("c1", "gone"), turn(3, 10)]

    expect(rawTokensSinceLastCompaction(records)).toBe(10)
  })

  it("only the last compaction counts, and entries that are not sources add nothing", () => {
    const records = [
      turn(1, 10),
      turn(2, 10),
      compactionRecord("c1", "r1"),
      turn(3, 10),
      compactionRecord("c2", "r3"),
      observationsRecord("o1", "r1", "r2", [seen]),
      turn(4, 10),
    ]

    expect(rawTokensSinceLastCompaction(records)).toBe(20)
  })
})

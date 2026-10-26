import { describe, expect, it } from "vitest"

import { ledgerOf } from "#src/domain"
import { assistantRecord, observation, observationsRecord, userRecord } from "#test-helpers"

const first = observation("2026-10-26T13:35:00", "first")
const second = observation("2026-10-26T13:36:00", "second")

describe("ledgerOf", () => {
  it("recorded entries become covered ranges by branch index, in branch order", () => {
    const records = [
      userRecord("u1", "one", 1),
      assistantRecord("a1", "two", 1),
      observationsRecord("o1", "u1", "a1", [first]),
      userRecord("u2", "three", 1),
      assistantRecord("a2", "four", 1),
      observationsRecord("o2", "u2", "a2", [second]),
    ]

    expect(ledgerOf(records).ranges).toEqual([
      { from: 0, to: 1, observations: [first] },
      { from: 3, to: 4, observations: [second] },
    ])
  })

  it("an entry whose range ends are not on the branch is ignored", () => {
    const records = [
      userRecord("u1", "one", 1),
      observationsRecord("o1", "u1", "gone", [first]),
      observationsRecord("o2", "gone", "u1", [second]),
    ]

    expect(ledgerOf(records).ranges).toEqual([])
  })

  it("the first observation with an id wins and later copies are dropped", () => {
    const copy = { ...first, content: "copy" }
    const records = [
      userRecord("u1", "one", 1),
      assistantRecord("a1", "two", 1),
      observationsRecord("o1", "u1", "u1", [first]),
      observationsRecord("o2", "a1", "a1", [copy, second]),
    ]

    expect(ledgerOf(records).ranges).toEqual([
      { from: 0, to: 0, observations: [first] },
      { from: 1, to: 1, observations: [second] },
    ])
  })

  it("used ids include every observation id on the branch", () => {
    const stray = observation("2026-10-26T13:37:00", "stray")
    const records = [
      userRecord("u1", "one", 1),
      observationsRecord("o1", "u1", "u1", [first, second]),
      observationsRecord("o2", "gone", "u1", [stray]),
    ]

    expect([...ledgerOf(records).used].sort()).toEqual([first.id, second.id, stray.id])
  })

  it("nothing is consolidated and the journey is empty", () => {
    const ledger = ledgerOf([userRecord("u1", "one", 1)])

    expect(ledger.consolidated.size).toBe(0)
    expect(ledger.journey).toBe("")
  })
})

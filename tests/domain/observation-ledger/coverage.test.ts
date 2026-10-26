import { describe, expect, it } from "vitest"

import { ledgerOf, uncoveredSpans } from "#src/domain"
import { assistantRecord, observationsRecord, otherRecord, toolResultRecord, userRecord } from "#test-helpers"

describe("uncoveredSpans", () => {
  it("source entries no range or in-flight chunk covers form spans, and a span followed by covered entries is closed", () => {
    const records = [
      userRecord("u1", "one", 1),
      assistantRecord("a1", "two", 1),
      userRecord("u2", "three", 1),
      assistantRecord("a2", "four", 1),
      userRecord("u3", "five", 1),
      userRecord("u4", "six", 1),
      userRecord("u5", "seven", 1),
      observationsRecord("o1", "u2", "a2", []),
    ]

    expect(uncoveredSpans(records, ledgerOf(records), [{ fromId: "u4", coversUpToId: "u4" }])).toEqual([
      { from: 0, to: 1, closed: true },
      { from: 4, to: 4, closed: true },
      { from: 6, to: 6, closed: false },
    ])
  })

  it("entries that are not sources do not break a span and are not counted in it", () => {
    const records = [
      userRecord("u1", "one", 1),
      otherRecord("x1"),
      toolResultRecord("t1", "read", "text", 1),
      otherRecord("x2"),
    ]

    expect(uncoveredSpans(records, ledgerOf(records), [])).toEqual([{ from: 0, to: 2, closed: false }])
  })

  it("everything covered leaves no span", () => {
    const records = [
      userRecord("u1", "one", 1),
      assistantRecord("a1", "two", 1),
      observationsRecord("o1", "u1", "a1", []),
    ]

    expect(uncoveredSpans(records, ledgerOf(records), [])).toEqual([])
  })
})

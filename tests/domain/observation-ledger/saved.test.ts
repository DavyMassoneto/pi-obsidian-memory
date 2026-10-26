import { describe, expect, it } from "vitest"

import { ledgerOf, savedNotesIn } from "#src/domain"
import {
  assistantRecord,
  observation,
  observationsRecord,
  savedRecord,
  sizedObservation,
  userRecord,
} from "#test-helpers"

const early = sizedObservation("2026-10-26T13:00:00", 10)
const late = sizedObservation("2026-10-26T14:00:00", 10)

describe("savedNotesIn", () => {
  it("memory_add saves inside the ranges of the promoted observations are returned, others are not", () => {
    const records = [
      userRecord("u1", "one", 1),
      savedRecord("s1", "project", "rules/Use pnpm.md"),
      assistantRecord("a1", "two", 1),
      observationsRecord("o1", "u1", "a1", [early]),
      savedRecord("s2", "global", "facts/User speaks Portuguese.md"),
      observationsRecord("o2", "s2", "s2", [late]),
      userRecord("u2", "three", 1),
    ]
    const ledger = ledgerOf(records)

    expect(savedNotesIn(records, ledger, [early.id])).toEqual([{ vault: "project", path: "rules/Use pnpm.md" }])
    expect(savedNotesIn(records, ledger, [late.id])).toEqual([
      { vault: "global", path: "facts/User speaks Portuguese.md" },
    ])
    expect(savedNotesIn(records, ledger, [early.id, late.id])).toHaveLength(2)
    expect(savedNotesIn(records, ledger, [])).toEqual([])
    expect(savedNotesIn(records, ledger, ["2026-10-26T15:00:00"])).toEqual([])
  })

  it("a save inside two ranges that overlap is returned once, in branch order", () => {
    const records = [
      savedRecord("s1", "project", "a.md"),
      savedRecord("s2", "project", "b.md"),
      savedRecord("s3", "project", "c.md"),
      observationsRecord("o1", "s1", "s2", [early]),
      observationsRecord("o2", "s2", "s3", [late]),
    ]

    expect(savedNotesIn(records, ledgerOf(records), [early.id, late.id])).toEqual([
      { vault: "project", path: "a.md" },
      { vault: "project", path: "b.md" },
      { vault: "project", path: "c.md" },
    ])
  })

  it("messages that did not save a note are left out", () => {
    const records = [userRecord("u1", "one", 1), observationsRecord("o1", "u1", "u1", [observation(early.id, "x")])]

    expect(savedNotesIn(records, ledgerOf(records), [early.id])).toEqual([])
  })
})

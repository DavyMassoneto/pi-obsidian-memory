import { expect, test } from "vitest"

import { dontForgetCandidates } from "#src/domain"
import { catalogEntry, catalogEntryWithNote, catalogSnapshot } from "#test-helpers"

test("returns the paths of marked, non-archived notes in snapshot order", () => {
  const snapshot = catalogSnapshot([
    catalogEntryWithNote("b/Second.md", {}),
    catalogEntryWithNote("a/Unmarked.md", { dontForget: false }),
    catalogEntryWithNote("a/First.md", {}),
  ])
  expect(dontForgetCandidates(snapshot)).toEqual(["b/Second.md", "a/First.md"])
})

test("excludes marked notes that are archived", () => {
  const snapshot = catalogSnapshot([
    catalogEntryWithNote("archive/a/Old.md", { archived: true }),
    catalogEntryWithNote("a/Kept.md", {}),
  ])
  expect(dontForgetCandidates(snapshot)).toEqual(["a/Kept.md"])
})

test("excludes entries without a note", () => {
  const snapshot = catalogSnapshot([{ ...catalogEntry("a/Broken.md"), note: null, needsFixing: true }])
  expect(dontForgetCandidates(snapshot)).toEqual([])
})

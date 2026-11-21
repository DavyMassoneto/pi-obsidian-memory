import { expect, test } from "vitest"

import { confirmedPrefix, confirmedSourceIds } from "#src/domain"

test("a completed later slice cannot cover a gap in the branch", () => {
  const entries = [
    { id: "A", parentId: null, text: "first", tokenCount: 1, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "second", tokenCount: 1, canStartKeptRange: true },
    { id: "C", parentId: "B", text: "third", tokenCount: 1, canStartKeptRange: true },
  ]
  const commits = [
    { sourceEntryIds: ["C"], observations: [] },
    { sourceEntryIds: ["A"], observations: [] },
  ]
  expect(confirmedPrefix(entries, commits)).toEqual(["A"])
  expect(new Set(confirmedSourceIds(entries, commits))).toEqual(new Set(["A", "C"]))
})

test("a commit from a different branch cannot confirm a shared ancestor", () => {
  const entries = [{ id: "A", parentId: null, text: "first", tokenCount: 1, canStartKeptRange: true }]
  const commits = [{ sourceEntryIds: ["A", "other-branch"], observations: [] }]
  expect(confirmedPrefix(entries, commits)).toEqual([])
})

test("empty observation results still confirm their sources and duplicate commits do not repeat coverage", () => {
  const entries = [
    { id: "A", parentId: null, text: "first", tokenCount: 1, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "second", tokenCount: 1, canStartKeptRange: true },
  ]
  const first = { sourceEntryIds: ["A"], observations: [] }
  const second = { sourceEntryIds: ["B"], observations: [] }
  expect(confirmedPrefix(entries, [second, first, first])).toEqual(["A", "B"])
})

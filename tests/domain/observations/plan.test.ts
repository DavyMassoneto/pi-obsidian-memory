import { expect, test } from "vitest"

import { planObservationSlices } from "#src/domain"

test("failed slices remain eligible while confirmed and in-flight sources are not dispatched twice", () => {
  const entries = [
    { id: "A", parentId: null, text: "first", tokenCount: 10, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "second", tokenCount: 10, canStartKeptRange: true },
    { id: "C", parentId: "B", text: "third", tokenCount: 10, canStartKeptRange: true },
  ]
  const settings = { chunkTokens: 10, chunkOverlapTokens: 0, maxSlices: 2 }
  const planned = planObservationSlices(entries, ["C"], ["B"], settings, false)
  expect(planned).toEqual([{ entries: [entries[0]], contextEntries: [] }])
})

test("a short tail waits for more source data unless a flush was requested", () => {
  const entries = [{ id: "A", parentId: null, text: "first", tokenCount: 3, canStartKeptRange: true }]
  const settings = { chunkTokens: 10, chunkOverlapTokens: 0, maxSlices: 2 }
  expect(planObservationSlices(entries, [], [], settings, false)).toEqual([])
  expect(planObservationSlices(entries, [], [], settings, true)).toEqual([{ entries, contextEntries: [] }])
})

test("overlap is read-only context and cannot become part of the new coverage slice", () => {
  const entries = [
    { id: "A", parentId: null, text: "first", tokenCount: 10, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "second", tokenCount: 10, canStartKeptRange: true },
  ]
  const settings = { chunkTokens: 10, chunkOverlapTokens: 10, maxSlices: 1 }
  expect(planObservationSlices(entries, ["A"], [], settings, false)).toEqual([
    { entries: [entries[1]], contextEntries: [entries[0]] },
  ])
})

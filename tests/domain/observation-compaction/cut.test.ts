import { expect, test } from "vitest"

import { selectCoveredCut } from "#src/domain"

test("compaction cannot remove an uncovered gap even if later entries were observed", () => {
  const entries = [
    { id: "A", parentId: null, text: "first", tokenCount: 10, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "second", tokenCount: 10, canStartKeptRange: true },
    { id: "C", parentId: "B", text: "third", tokenCount: 10, canStartKeptRange: true },
    { id: "D", parentId: "C", text: "fourth", tokenCount: 10, canStartKeptRange: true },
  ]
  expect(selectCoveredCut(entries, ["A", "C", "D"], 10)).toBe("B")
  expect(selectCoveredCut(entries, [], 10)).toBeNull()
})

test("compaction retains the requested literal tail and snaps away from a tool-result boundary", () => {
  const entries = [
    { id: "A", parentId: null, text: "user", tokenCount: 10, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "user", tokenCount: 10, canStartKeptRange: true },
    { id: "C", parentId: "B", text: "tool call", tokenCount: 10, canStartKeptRange: false },
    { id: "D", parentId: "C", text: "tool result", tokenCount: 10, canStartKeptRange: false },
  ]
  expect(selectCoveredCut(entries, ["A", "B", "C", "D"], 20)).toBe("B")
  expect(selectCoveredCut(entries, ["A", "B", "C", "D"], 40)).toBeNull()
})

test("an empty branch or a branch without a safe retained range cannot be compacted", () => {
  expect(selectCoveredCut([], [], 10)).toBeNull()
  const entries = [
    { id: "A", parentId: null, text: "user", tokenCount: 10, canStartKeptRange: true },
    { id: "B", parentId: "A", text: "assistant", tokenCount: 10, canStartKeptRange: false },
  ]
  expect(selectCoveredCut(entries, ["A", "B"], 10)).toBeNull()
})

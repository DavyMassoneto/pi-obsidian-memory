import { expect, test } from "vitest"

import { planObservationCompaction } from "#src/domain"

function entry(id: string, parentId: string | null, tokens: number) {
  return { id, parentId, text: id, tokenCount: tokens, canStartKeptRange: true }
}

function commit(id: string, sources: string[]) {
  const observation = {
    id: `obs-${id}`,
    timestamp: "2026-11-21T02:00:00.000Z",
    content: `Fact ${id}`,
    sourceEntryIds: sources,
    tokenCount: 3,
  }
  return { sourceEntryIds: sources, observations: [observation] }
}

test("compaction summarizes only observations whose sources are entirely removed and keeps the literal tail", () => {
  const sources = [entry("A", null, 10), entry("B", "A", 10), entry("C", "B", 10), entry("D", "C", 10)]
  const commits = [commit("A", ["A"]), commit("B", ["B"]), commit("C", ["C"]), commit("D", ["D"])]
  const plan = planObservationCompaction({ sources, commits, memoryMap: "", tailTokens: 20 })
  expect(plan?.firstKeptEntryId).toBe("C")
  expect(plan?.summary).toContain("Fact A")
  expect(plan?.summary).toContain("Fact B")
  expect(plan?.summary).not.toContain("Fact C")
  expect(plan?.summary).not.toContain("Fact D")
})

test("an unobserved gap prevents compaction beyond it", () => {
  const sources = [entry("A", null, 10), entry("B", "A", 10), entry("C", "B", 10), entry("D", "C", 10)]
  const commits = [commit("A", ["A"]), commit("C", ["C"]), commit("D", ["D"])]
  const plan = planObservationCompaction({ sources, commits, memoryMap: "", tailTokens: 10 })
  expect(plan?.firstKeptEntryId).toBe("B")
  expect(plan?.summary).toContain("Fact A")
  expect(plan?.summary).not.toContain("Fact C")
})

test("no confirmed prefix means the host compaction is left alone", () => {
  const sources = [entry("A", null, 10), entry("B", "A", 10)]
  expect(planObservationCompaction({ sources, commits: [], memoryMap: "map", tailTokens: 5 })).toBeNull()
})

test("an empty observation result still removes a confirmed range and carries the memory map", () => {
  const sources = [entry("A", null, 10), entry("B", "A", 10)]
  const plan = planObservationCompaction({
    sources,
    commits: [{ sourceEntryIds: ["A"], observations: [] }],
    memoryMap: "Memory map: m",
    tailTokens: 5,
  })
  expect(plan?.firstKeptEntryId).toBe("B")
  expect(plan?.summary).toContain("Memory map: m")
})

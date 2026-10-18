import { describe, expect, it } from "vitest"

import { fuseRankings, semanticRanking } from "#src/domain"

describe("fuseRankings", () => {
  it("scores each list by 1 / (60 + rank) and sums them", () => {
    const fused = fuseRankings(["a", "b"], ["b", "c"])
    expect(fused).toEqual([
      { path: "b", score: 1 / 62 + 1 / 61 },
      { path: "a", score: 1 / 61 },
      { path: "c", score: 1 / 62 },
    ])
  })

  it("orders a note found by both lists before notes found by one", () => {
    expect(fuseRankings(["a", "b", "c"], ["c"]).map((item) => item.path)).toEqual(["c", "a", "b"])
  })

  it("breaks ties by path", () => {
    expect(fuseRankings(["z", "a"], ["a", "z"]).map((item) => item.path)).toEqual(["a", "z"])
    expect(fuseRankings(["b"], ["a"]).map((item) => item.path)).toEqual(["a", "b"])
  })

  it("works when one list is empty", () => {
    expect(fuseRankings([], ["b", "a"]).map((item) => item.path)).toEqual(["b", "a"])
    expect(fuseRankings(["b", "a"], []).map((item) => item.path)).toEqual(["b", "a"])
    expect(fuseRankings([], [])).toEqual([])
  })
})

describe("semanticRanking", () => {
  const scored = [
    { path: "b", similarity: 0.9 },
    { path: "a", similarity: 0.7 },
    { path: "c", similarity: 0.95 },
  ]

  it("sorts by similarity descending", () => {
    expect(semanticRanking(scored, null)).toEqual(["c", "b", "a"])
  })

  it("breaks equal similarity by path", () => {
    const tied = [
      { path: "z", similarity: 0.8 },
      { path: "a", similarity: 0.8 },
    ]
    expect(semanticRanking(tied, null)).toEqual(["a", "z"])
  })

  it("drops entries below the minimum and keeps one exactly at it", () => {
    expect(semanticRanking(scored, 0.9)).toEqual(["c", "b"])
    expect(semanticRanking(scored, 0.91)).toEqual(["c"])
  })

  it("keeps a minimum of 0 as a real minimum", () => {
    const mixed = [
      { path: "a", similarity: -0.1 },
      { path: "b", similarity: 0 },
    ]
    expect(semanticRanking(mixed, 0)).toEqual(["b"])
  })

  it("returns nothing for no entries", () => {
    expect(semanticRanking([], 0.8)).toEqual([])
  })
})

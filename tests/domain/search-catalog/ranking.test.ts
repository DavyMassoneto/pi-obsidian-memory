import { describe, expect, it } from "vitest"

import { fuseRankings, semanticRanking } from "#src/domain"

describe("fuseRankings", () => {
  it("scores each list by 1 / (60 + rank) and sums them", () => {
    const fused = fuseRankings(["a", "b"], ["b", "c"], 10)
    expect(fused).toEqual([
      { path: "b", score: 1 / 62 + 1 / 61 },
      { path: "a", score: 1 / 61 },
      { path: "c", score: 1 / 62 },
    ])
  })

  it("orders a note found by both lists before notes found by one", () => {
    expect(fuseRankings(["a", "b", "c"], ["c"], 10).map((item) => item.path)).toEqual(["c", "a", "b"])
  })

  it("breaks ties by path", () => {
    expect(fuseRankings(["z", "a"], ["a", "z"], 10).map((item) => item.path)).toEqual(["a", "z"])
    expect(fuseRankings(["b"], ["a"], 10).map((item) => item.path)).toEqual(["a", "b"])
  })

  it("cuts to the limit after fusing", () => {
    expect(fuseRankings(["a", "b", "c"], ["c", "b", "a"], 2).map((item) => item.path)).toEqual(["a", "c"])
    expect(fuseRankings(["a"], ["b"], 0)).toEqual([])
  })

  it("works when one list is empty", () => {
    expect(fuseRankings([], ["b", "a"], 10).map((item) => item.path)).toEqual(["b", "a"])
    expect(fuseRankings(["b", "a"], [], 10).map((item) => item.path)).toEqual(["b", "a"])
    expect(fuseRankings([], [], 10)).toEqual([])
  })

  it.each([-1, 1.5, Number.NaN, Infinity])("refuses limit %s", (limit) => {
    expect(() => fuseRankings(["a"], ["b"], limit)).toThrow(RangeError)
  })
})

describe("semanticRanking", () => {
  const scored = [
    { path: "b", similarity: 0.9 },
    { path: "a", similarity: 0.7 },
    { path: "c", similarity: 0.95 },
  ]

  it("sorts by similarity descending", () => {
    expect(semanticRanking(scored, null, 10)).toEqual(["c", "b", "a"])
  })

  it("breaks equal similarity by path", () => {
    const tied = [
      { path: "z", similarity: 0.8 },
      { path: "a", similarity: 0.8 },
    ]
    expect(semanticRanking(tied, null, 10)).toEqual(["a", "z"])
  })

  it("drops entries below the minimum and keeps one exactly at it", () => {
    expect(semanticRanking(scored, 0.9, 10)).toEqual(["c", "b"])
    expect(semanticRanking(scored, 0.91, 10)).toEqual(["c"])
  })

  it("keeps a minimum of 0 as a real minimum", () => {
    const mixed = [
      { path: "a", similarity: -0.1 },
      { path: "b", similarity: 0 },
    ]
    expect(semanticRanking(mixed, 0, 10)).toEqual(["b"])
  })

  it("applies the minimum before the limit", () => {
    expect(semanticRanking(scored, 0.9, 1)).toEqual(["c"])
    expect(semanticRanking(scored, null, 2)).toEqual(["c", "b"])
    expect(semanticRanking(scored, null, 0)).toEqual([])
  })

  it("returns nothing for no entries", () => {
    expect(semanticRanking([], 0.8, 5)).toEqual([])
  })

  it.each([-1, 1.5, Number.NaN, Infinity])("refuses limit %s", (limit) => {
    expect(() => semanticRanking(scored, null, limit)).toThrow(RangeError)
  })
})

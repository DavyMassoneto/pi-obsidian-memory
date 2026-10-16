import { describe, expect, it } from "vitest"

import { fuseRankings } from "#src/domain"

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

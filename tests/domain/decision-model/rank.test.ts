import { describe, expect, it } from "vitest"

import { rankCandidates, shouldRetrieveMemory } from "#src/domain"
import { globalScore } from "#test-helpers"

describe("shouldRetrieveMemory", () => {
  it("retrieves only when the probability is above the cutoff", () => {
    expect(shouldRetrieveMemory(0.5, 0.5)).toBe(false)
    expect(shouldRetrieveMemory(0.50001, 0.5)).toBe(true)
    expect(shouldRetrieveMemory(0.2, 0.2)).toBe(false)
    expect(shouldRetrieveMemory(0.20001, 0.2)).toBe(true)
  })

  it("accepts the extreme cutoffs 0 and 1", () => {
    expect(shouldRetrieveMemory(0, 0)).toBe(false)
    expect(shouldRetrieveMemory(0.0001, 0)).toBe(true)
    expect(shouldRetrieveMemory(1, 1)).toBe(false)
  })

  it.each([NaN, Infinity, -0.1, 1.1])("refuses the invalid probability %s", (probability) => {
    expect(() => shouldRetrieveMemory(probability, 0.5)).toThrow(RangeError)
  })

  it.each([NaN, Infinity, -0.1, 1.1])("refuses the invalid cutoff %s", (cutoff) => {
    expect(() => shouldRetrieveMemory(0.5, cutoff)).toThrow(RangeError)
  })
})

describe("rankCandidates", () => {
  it("keeps notes at or above the cutoff, below it they are dropped", () => {
    const scores = [globalScore("a", 0.49), globalScore("b", 0.5), globalScore("c", 0.51)]
    expect(rankCandidates(scores, 0.5)).toEqual([scores[2], scores[1]])
    expect(rankCandidates(scores, 0.3)).toEqual([scores[2], scores[1], scores[0]])
    expect(rankCandidates(scores, 0.51)).toEqual([scores[2]])
  })

  it("returns an empty list when every note is below the cutoff", () => {
    expect(rankCandidates([globalScore("a", 0.1), globalScore("b", 0.49)], 0.5)).toEqual([])
    expect(rankCandidates([], 0.5)).toEqual([])
  })

  it("keeps everything at cutoff 0 and only certainty at cutoff 1", () => {
    const scores = [globalScore("a", 0), globalScore("b", 1), globalScore("c", 0.99)]
    expect(rankCandidates(scores, 0)).toEqual([scores[1], scores[2], scores[0]])
    expect(rankCandidates(scores, 1)).toEqual([scores[1]])
  })

  it("sorts descending with stable identity ties without mutating the input", () => {
    const scores = [
      { identity: { vault: "project" as const, id: "b", revision: "1" }, probability: 0.8 },
      { identity: { vault: "global" as const, id: "a", revision: "2" }, probability: 0.8 },
      { identity: { vault: "global" as const, id: "c", revision: "1" }, probability: 0.5 },
    ]
    expect(rankCandidates(scores, 0.5)).toEqual([scores[1], scores[0], scores[2]])
    expect(scores[0]?.identity.id).toBe("b")
  })

  it.each([NaN, Infinity, -0.1, 1.1])("refuses the invalid probability %s", (probability) => {
    expect(() => rankCandidates([globalScore("a", probability)], 0.5)).toThrow(RangeError)
  })

  it.each([NaN, Infinity, -0.1, 1.1])("refuses the invalid cutoff %s", (cutoff) => {
    expect(() => rankCandidates([globalScore("a", 0.5)], cutoff)).toThrow(RangeError)
  })
})

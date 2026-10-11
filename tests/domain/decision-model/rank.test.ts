import { describe, expect, it } from "vitest"

import { rankCandidates, shouldRetrieveMemory } from "#/domain"

describe("decision model initial ranking policy", () => {
  it("retrieves unless a valid probability is at most 0.2", () => {
    expect(shouldRetrieveMemory(0)).toBe(false)
    expect(shouldRetrieveMemory(0.2)).toBe(false)
    expect(shouldRetrieveMemory(0.20001)).toBe(true)
    expect(shouldRetrieveMemory(1)).toBe(true)
    for (const probability of [NaN, Infinity, -0.1, 1.1]) {
      expect(() => shouldRetrieveMemory(probability)).toThrow(RangeError)
    }
  })

  it("keeps the 0.5 boundary and sorts descending with stable identity ties without mutation", () => {
    const scores = [
      { identity: { vault: "project" as const, id: "b", revision: "1" }, probability: 0.8 },
      { identity: { vault: "global" as const, id: "a", revision: "2" }, probability: 0.8 },
      { identity: { vault: "global" as const, id: "c", revision: "1" }, probability: 0.5 },
      { identity: { vault: "global" as const, id: "d", revision: "1" }, probability: 0.49 },
    ]
    expect(rankCandidates(scores)).toEqual([scores[1], scores[0], scores[2]])
    expect(scores[0]?.identity.id).toBe("b")
    expect(() => rankCandidates([{ identity: { vault: "global", id: "a", revision: "1" }, probability: NaN }])).toThrow(
      RangeError,
    )
  })
})

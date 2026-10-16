import { describe, expect, it } from "vitest"

import { aggregateVectors, cosine, normalizeVector } from "#src/domain"

describe("normalizeVector", () => {
  it("normalizes finite nonzero vectors without overflow or underflow", () => {
    expect(normalizeVector([3, 4], 2)).toEqual([0.6, 0.8])
    expect(normalizeVector([3e300, 4e300], 2)).toEqual([0.6, 0.8])
    expect(normalizeVector([3e-300, 4e-300], 2)).toEqual([0.6, 0.8])
  })

  it.each([
    { values: [0, 0] },
    { values: [Number.NaN, 1] },
    { values: [Infinity, 1] },
    { values: [1] },
    { values: [] },
  ])("refuses invalid vector %j", ({ values }) => {
    expect(normalizeVector(values, 2)).toBeNull()
  })

  it("aggregates every chunk and refuses cancelling or malformed vectors", () => {
    const aggregate = aggregateVectors(
      [
        [1, 0],
        [0, 1],
      ],
      2,
    )
    expect(aggregate).toEqual([expect.closeTo(Math.SQRT1_2), expect.closeTo(Math.SQRT1_2)])
    expect(
      aggregateVectors(
        [
          [1, 0],
          [-1, 0],
        ],
        2,
      ),
    ).toBeNull()
    expect(aggregateVectors([], 2)).toBeNull()
    expect(aggregateVectors([[1]], 2)).toBeNull()
  })
})

describe("cosine", () => {
  it("is 1 for the same direction, 0 for orthogonal and -1 for opposite vectors", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it("does not depend on vector length", () => {
    expect(cosine([2, 0], [3, 0])).toBeCloseTo(1)
    expect(cosine([3, 4], [4, 3])).toBeCloseTo(24 / 25)
  })

  it("agrees with the dot product of normalized vectors", () => {
    expect(cosine([0.6, 0.8], [0.8, 0.6])).toBeCloseTo(0.96)
  })

  it.each([
    { left: [1, 0], right: [1] },
    { left: [0, 0], right: [1, 0] },
    { left: [1, 0], right: [0, 0] },
  ])("refuses mismatched or zero vectors %j", ({ left, right }) => {
    expect(() => cosine(left, right)).toThrow(RangeError)
  })
})

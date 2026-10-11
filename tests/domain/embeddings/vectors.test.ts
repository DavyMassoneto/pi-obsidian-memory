import { describe, expect, it } from "vitest"

import { aggregateVectors, normalizeVector } from "#/domain"

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

import { describe, expect, it } from "vitest"

import { poolTokens, selectPromotion } from "#src/domain"
import { ledgerHolding, sizedObservation } from "#test-helpers"

const oldest = sizedObservation("2026-10-26T13:00:00", 40)
const older = sizedObservation("2026-10-26T13:10:00", 40)
const newer = sizedObservation("2026-10-26T13:20:00", 40)
const newest = sizedObservation("2026-10-26T13:30:00", 40)

describe("poolTokens", () => {
  it("adds the tokens of the active observations only", () => {
    expect(poolTokens(ledgerHolding([oldest, older, newer], []))).toBe(120)
    expect(poolTokens(ledgerHolding([oldest, older, newer], [older.id]))).toBe(80)
    expect(poolTokens(ledgerHolding([], []))).toBe(0)
  })
})

describe("selectPromotion", () => {
  it("4×40 tokens with a target of 100 promotes the two oldest; a pool within target promotes none; a lone 500-token newest is kept", () => {
    const pool = ledgerHolding([newest, oldest, newer, older], [])

    expect(selectPromotion(pool, 100)).toEqual([oldest, older])
    expect(selectPromotion(pool, 160)).toEqual([])
    expect(selectPromotion(pool, 1000)).toEqual([])
    const lone = sizedObservation("2026-10-26T14:00:00", 500)
    expect(selectPromotion(ledgerHolding([lone], []), 100)).toEqual([])
    expect(selectPromotion(ledgerHolding([older, lone], []), 100)).toEqual([older])
  })

  it("the newest is kept even when the target is below it, and the walk stops at the first one that does not fit", () => {
    const small = sizedObservation("2026-10-26T12:00:00", 5)
    const pool = ledgerHolding([small, oldest, older, newer], [])

    expect(selectPromotion(pool, 10)).toEqual([small, oldest, older])
    expect(selectPromotion(pool, 85)).toEqual([small, oldest])
  })

  it("consolidated observations are not part of the pool", () => {
    const pool = ledgerHolding([oldest, older, newer, newest], [oldest.id, newest.id])

    expect(selectPromotion(pool, 40)).toEqual([older])
  })
})

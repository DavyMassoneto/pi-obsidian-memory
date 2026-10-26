import { describe, expect, it } from "vitest"

import { compactionObservations, ledgerOf } from "#src/domain"
import { observation, recordsWithThreeChunks } from "#test-helpers"

const early = observation("2026-10-26T13:35:00", "early")
const middleLater = observation("2026-10-26T13:50:00", "middle later")
const middleEarlier = observation("2026-10-26T13:40:00", "middle earlier")
const late = observation("2026-10-26T14:10:00", "late")

describe("compactionObservations", () => {
  it("only observations of chunks that end before the cut are kept, sorted by id", () => {
    const ledger = ledgerOf(recordsWithThreeChunks(early, middleLater, middleEarlier, late))

    expect(compactionObservations(ledger, 6)).toEqual([early, middleEarlier, middleLater])
    expect(compactionObservations(ledger, 3)).toEqual([early])
  })

  it("observations already consolidated are left out", () => {
    const ledger = {
      ...ledgerOf(recordsWithThreeChunks(early, middleLater, middleEarlier, late)),
      consolidated: new Set([early.id]),
    }

    expect(compactionObservations(ledger, 6)).toEqual([middleEarlier, middleLater])
  })
})

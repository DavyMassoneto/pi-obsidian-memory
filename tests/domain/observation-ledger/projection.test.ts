import { describe, expect, it } from "vitest"

import { compactionObservations, ledgerOf, type SessionRecord } from "#src/domain"
import { observation, observationsRecord, turn } from "#test-helpers"

const early = observation("2026-10-26T13:35:00", "early")
const middleLater = observation("2026-10-26T13:50:00", "middle later")
const middleEarlier = observation("2026-10-26T13:40:00", "middle earlier")
const late = observation("2026-10-26T14:10:00", "late")

function recordsWithThreeChunks(): SessionRecord[] {
  return [
    turn(1, 10),
    turn(2, 10),
    observationsRecord("o1", "r1", "r2", [early]),
    turn(3, 10),
    turn(4, 10),
    observationsRecord("o2", "r3", "r4", [middleLater, middleEarlier]),
    turn(5, 10),
    turn(6, 10),
    observationsRecord("o3", "r5", "r6", [late]),
  ]
}

describe("compactionObservations", () => {
  it("only observations of chunks that end before the cut are kept, sorted by id", () => {
    const ledger = ledgerOf(recordsWithThreeChunks())

    expect(compactionObservations(ledger, 6)).toEqual([early, middleEarlier, middleLater])
    expect(compactionObservations(ledger, 3)).toEqual([early])
  })

  it("observations already consolidated are left out", () => {
    const ledger = { ...ledgerOf(recordsWithThreeChunks()), consolidated: new Set([early.id]) }

    expect(compactionObservations(ledger, 6)).toEqual([middleEarlier, middleLater])
  })
})

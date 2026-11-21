import { describe, expect, it } from "vitest"

import { consolidatedData, parseJourneyReply } from "#src/domain"
import { ledgerHolding, sizedObservation } from "#test-helpers"

const first = sizedObservation("2026-10-26T13:00:00", 10)
const second = sizedObservation("2026-10-26T13:10:00", 10)
const third = sizedObservation("2026-10-26T13:20:00", 10)
const unknown = sizedObservation("2026-10-26T13:30:00", 10)

describe("consolidatedData", () => {
  it("consolidated data keeps only ids still active", () => {
    const ledger = ledgerHolding([first, second, third], [first.id])

    expect(consolidatedData([first, second, third, unknown], ledger, "the journey")).toEqual({
      observationIds: [second.id, third.id],
      journey: "the journey",
    })
  })

  it("is null when none of the promoted observations is active any more", () => {
    const ledger = ledgerHolding([first, second], [first.id])

    expect(consolidatedData([first, unknown], ledger, "the journey")).toBeNull()
    expect(consolidatedData([], ledger, "the journey")).toBeNull()
  })
})

describe("parseJourneyReply", () => {
  it("reads the journey text as it is", () => {
    const journey = "### 2026-10-26 13:35\nWorked on the pool.\n"

    expect(parseJourneyReply(JSON.stringify({ journey }))).toEqual({ succeeded: true, output: journey })
    expect(parseJourneyReply(JSON.stringify({ journey: "" }))).toEqual({ succeeded: true, output: "" })
  })

  it("a journey reply with extra keys is refused", () => {
    const refusal = parseJourneyReply(JSON.stringify({ journey: "text", note: "extra" }))

    expect(refusal.succeeded).toBe(false)
    if (!refusal.succeeded) expect(refusal.problems.length).toBeGreaterThan(0)
  })

  it("a reply without a string journey, or that is not JSON, is refused", () => {
    for (const text of [JSON.stringify({}), JSON.stringify({ journey: 5 }), JSON.stringify([]), "null"]) {
      expect(parseJourneyReply(text).succeeded).toBe(false)
    }
    expect(parseJourneyReply("not json")).toEqual({ succeeded: false, problems: ["Invalid journey JSON"] })
  })
})

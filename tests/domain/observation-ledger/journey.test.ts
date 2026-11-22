import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { consolidatedData, parseJourneyReply } from "#src/domain"
import { ConsolidatedByOlderVersionsSchema, ledgerHolding, sizedObservation, withOrigin } from "#test-helpers"

const first = sizedObservation("2026-10-26T13:00:00", 10)
const second = sizedObservation("2026-10-26T13:10:00", 10)
const third = sizedObservation("2026-10-26T13:20:00", 10)
const unknown = sizedObservation("2026-10-26T13:30:00", 10)

describe("consolidatedData", () => {
  it("consolidated data keeps only ids still active", () => {
    const ledger = ledgerHolding([first, second, third], [first.id])

    expect(consolidatedData([first, second, third, unknown], ledger, "the journey", [], [])).toEqual({
      consolidated: { observationIds: [second.id, third.id], journey: "the journey" },
      meta: null,
    })
  })

  it("records which observations the journey was written knowing to be read material", () => {
    const ledger = ledgerHolding([first, second, third], [first.id])
    const told = [withOrigin(first, "material"), withOrigin(second, "material"), withOrigin(third, "user")]

    expect(consolidatedData([second, third], ledger, "the journey", told, [])).toEqual({
      consolidated: { observationIds: [second.id, third.id], journey: "the journey" },
      meta: { observationIds: [second.id, third.id], materialIds: [first.id, second.id] },
    })
  })

  it("writes nothing when none of the promoted observations is active any more", () => {
    const ledger = ledgerHolding([first, second], [first.id])
    const nothing = { consolidated: null, meta: null }

    expect(consolidatedData([first, unknown], ledger, "the journey", [], [])).toEqual(nothing)
    expect(consolidatedData([], ledger, "the journey", [], [])).toEqual(nothing)
  })

  it("records the notes the batch changed beside the plain record, which stays in the shape older versions read", () => {
    const ledger = ledgerHolding([first, second], [])
    const notes = [{ vault: "global" as const, path: "rules/Never commit.md" }]

    const written = consolidatedData([first], ledger, "the journey", [], notes)

    expect(written).toEqual({
      consolidated: { observationIds: [first.id], journey: "the journey" },
      meta: { observationIds: [first.id], notes },
    })
    expect(Value.Check(ConsolidatedByOlderVersionsSchema, written.consolidated)).toBe(true)
  })

  it("a run that only took corrections into account writes no plain record: its journey goes in the companion record", () => {
    const ledger = ledgerHolding([first, second], [first.id])

    expect(consolidatedData([], ledger, "the journey", [withOrigin(first, "material")], [])).toEqual({
      consolidated: null,
      meta: { observationIds: [], journey: "the journey", materialIds: [first.id] },
    })
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

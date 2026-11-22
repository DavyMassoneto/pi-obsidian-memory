import { describe, expect, it } from "vitest"

import { CORRECTION_LEAD, compactionObservations, correctionMaterial, ledgerOf, textTokens } from "#src/domain"
import {
  ASKED_FOR_CSV,
  buildRectification,
  consolidatedBeforeOrigins,
  consolidatedRecord,
  consolidationMetaRecord,
  csvRectification,
  FIRST_BUILD,
  ORDERED_IN_TEST_PROMPT,
  READ_TRANSCRIPT,
  RESTATED_NO_COMMIT,
  recordedBeforeOrigins,
  rectifiedRecord,
  SAID_IN_TRANSCRIPT,
  SAID_REWRITTEN,
  transcriptOrigins,
  transcriptRectification,
  transcriptRepaired,
  withOrigin,
} from "#test-helpers"

describe("ledgerOf with rectifications", () => {
  it("from the rectification records on, the observations are the rectified version and the original records are untouched", () => {
    const original = recordedBeforeOrigins()
    const records = [
      ...original,
      rectifiedRecord("x0", buildRectification()),
      rectifiedRecord("x1", transcriptRectification(transcriptRepaired())),
      rectifiedRecord("x2", csvRectification()),
    ]

    expect(compactionObservations(ledgerOf(records), records.length)).toEqual([
      withOrigin(FIRST_BUILD, "mention"),
      {
        id: SAID_IN_TRANSCRIPT.id,
        content: SAID_REWRITTEN,
        tokens: textTokens(SAID_REWRITTEN),
        origin: "material",
        sources: ["t1"],
      },
      withOrigin(READ_TRANSCRIPT, "mention"),
      { ...RESTATED_NO_COMMIT, origin: "restated", sources: ["u0"] },
      { ...ASKED_FOR_CSV, origin: "user", sources: ["u2"] },
      withOrigin(ORDERED_IN_TEST_PROMPT, "mention"),
    ])
    expect(records.slice(0, original.length)).toEqual(recordedBeforeOrigins())
  })

  it("before any rectification every observation is unverified, whatever its words", () => {
    const records = recordedBeforeOrigins()

    expect(compactionObservations(ledgerOf(records), records.length)).toEqual([
      withOrigin(FIRST_BUILD, "unverified"),
      withOrigin(SAID_IN_TRANSCRIPT, "unverified"),
      withOrigin(READ_TRANSCRIPT, "unverified"),
      withOrigin(RESTATED_NO_COMMIT, "unverified"),
      withOrigin(ASKED_FOR_CSV, "unverified"),
      withOrigin(ORDERED_IN_TEST_PROMPT, "unverified"),
    ])
  })

  it("an attribution left unconfirmed carries no source, even when part of it was found in a user message", () => {
    const partial = { id: ASKED_FOR_CSV.id, origin: "unconfirmed" as const, supportedBy: "u2", quote: "exportar" }
    const data = { ...csvRectification(), observations: [partial] }
    const records = [...recordedBeforeOrigins(), rectifiedRecord("x2", data)]

    expect(ledgerOf(records).ranges[2]?.observations[0]).toEqual(withOrigin(ASKED_FOR_CSV, "unconfirmed"))
  })

  it("a partial attribution keeps its text and carries the user message and the user's own words", () => {
    const partial = {
      id: ASKED_FOR_CSV.id,
      origin: "partial" as const,
      supportedBy: "u2",
      quote: "exportar",
      quotes: ["exportar", "em CSV"],
    }
    const records = [
      ...recordedBeforeOrigins(),
      rectifiedRecord("x2", { ...csvRectification(), observations: [partial] }),
    ]

    expect(ledgerOf(records).ranges[2]?.observations[0]).toEqual({
      ...ASKED_FOR_CSV,
      origin: "partial",
      sources: ["u2"],
      userWords: ["exportar", "em CSV"],
    })
  })

  it("a false attribution that could not be rewritten keeps its text and has no source", () => {
    const records = [...recordedBeforeOrigins(), rectifiedRecord("x1", transcriptRectification(transcriptOrigins()))]

    expect(ledgerOf(records).ranges[1]?.observations[0]).toEqual(withOrigin(SAID_IN_TRANSCRIPT, "material"))
  })

  it("the latest rectification of a record wins, and a rectification applies only to the record it points at", () => {
    const first = transcriptRectification(transcriptOrigins())
    const elsewhere = { ...transcriptRectification(transcriptRepaired()), recordId: "o2" }
    const records = [...recordedBeforeOrigins(), rectifiedRecord("x1", first), rectifiedRecord("x0", elsewhere)]

    expect(ledgerOf(records).ranges[1]?.observations[0]).toEqual(withOrigin(SAID_IN_TRANSCRIPT, "material"))
    records.push(rectifiedRecord("x3", transcriptRectification(transcriptRepaired())))
    expect(ledgerOf(records).ranges[1]?.observations[0]?.content).toBe(SAID_REWRITTEN)
  })
})

describe("journey corrections", () => {
  const notes = [{ vault: "global" as const, path: "rules/Bot in production.md" }]
  const elsewhere = [{ vault: "global" as const, path: "other/Unrelated.md" }]

  it("an observation already folded into the journey and later found not to be the user's is a pending correction, in its rectified wording", () => {
    const rectification = transcriptRectification(transcriptRepaired())
    const records = [...consolidatedBeforeOrigins(), rectifiedRecord("x1", rectification)]

    expect(ledgerOf(records).corrections.map((item) => item.content)).toEqual([SAID_REWRITTEN])
  })

  it("the notes changed by the batch that consumed a pending correction are the notes to review, and its text for the reviewer says the user did not say it", () => {
    const records = [
      ...recordedBeforeOrigins(),
      consolidatedRecord("c1", [SAID_IN_TRANSCRIPT.id], "journey"),
      consolidationMetaRecord("m1", { observationIds: [SAID_IN_TRANSCRIPT.id], notes }),
      consolidatedRecord("c0", [READ_TRANSCRIPT.id], "journey"),
      consolidationMetaRecord("m0", { observationIds: [READ_TRANSCRIPT.id], notes: elsewhere }),
      rectifiedRecord("x1", transcriptRectification(transcriptRepaired())),
    ]
    const ledger = ledgerOf(records)

    expect(ledger.correctionNotes).toEqual(notes)
    expect(correctionMaterial(ledger.corrections, ledger.correctionNotes)).toEqual([
      { label: `correction ${SAID_IN_TRANSCRIPT.id}`, text: `${CORRECTION_LEAD} ${SAID_REWRITTEN}` },
    ])
    expect(correctionMaterial(ledger.corrections, [])).toEqual([])
  })

  it("once a journey is written knowing it, the correction is no longer pending, and that journey is the one in force even when no observation was promoted with it", () => {
    const records = [
      ...consolidatedBeforeOrigins(),
      rectifiedRecord("x1", transcriptRectification(transcriptOrigins())),
      consolidationMetaRecord("m2", { observationIds: [], journey: "rewritten", materialIds: [SAID_IN_TRANSCRIPT.id] }),
    ]
    const ledger = ledgerOf(records)

    expect(ledger.corrections).toEqual([])
    expect(ledger.journey).toBe("rewritten")
  })

  it("a later plain consolidation replaces the journey again", () => {
    const records = [
      ...consolidatedBeforeOrigins(),
      consolidationMetaRecord("m2", { observationIds: [], journey: "rewritten" }),
      consolidatedRecord("c3", [RESTATED_NO_COMMIT.id], "newest"),
    ]

    expect(ledgerOf(records).journey).toBe("newest")
  })

  it("with nothing rectified there is no correction", () => {
    expect(ledgerOf(consolidatedBeforeOrigins()).corrections).toEqual([])
    expect(ledgerOf(consolidatedBeforeOrigins()).correctionNotes).toEqual([])
  })
})

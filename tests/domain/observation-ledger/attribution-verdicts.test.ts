import { describe, expect, it } from "vitest"

import { verifiedOrigins } from "#src/domain"
import {
  ASKED_FOR_CSV,
  csvCheck,
  csvRectification,
  csvVerdicts,
  NO_COMMIT,
  ORDERED_IN_TEST_PROMPT,
  observation,
  verdict,
  WANTS_CSV,
} from "#test-helpers"

describe("verifiedOrigins, by what the verdict reports", () => {
  it("unknown authorship does not accidentally settle as a neutral mention", () => {
    const result = verifiedOrigins(csvCheck(), [verdict(ASKED_FOR_CSV.id, { actor: "unknown" })])
    expect(result).toMatchObject({
      output: [
        { id: ASKED_FOR_CSV.id, origin: "unconfirmed" },
        { id: ORDERED_IN_TEST_PROMPT.id, origin: "unconfirmed" },
      ],
    })
  })

  it("a quoted passage that happens to be in an earlier user message marks nothing when the observation reports nobody's words: what the assistant did or a plain fact stays unmarked", () => {
    const quoting = observation("2026-10-26T13:41:00", `Assistant renamed the test to '${NO_COMMIT}' and ran it.`)
    const check = { ...csvCheck(), observations: [{ id: quoting.id, content: quoting.content }] }

    expect(verifiedOrigins(check, [verdict(quoting.id, { actor: "none" })])).toEqual({
      succeeded: true,
      output: [{ id: quoting.id, origin: "mention" }],
    })
  })

  it("partial evidence from other messages is not attributed to the cited message", () => {
    const quoting = observation("2026-10-26T13:41:00", "User asked for CSV with unrelated conditions.")
    const check = { ...csvCheck(), observations: [quoting] }
    const partial = verdict(quoting.id, {
      actor: "user",
      partial: true,
      supportedBy: "u2",
      quote: WANTS_CSV,
      moreQuotes: [NO_COMMIT, WANTS_CSV],
    })
    expect(verifiedOrigins(check, [partial])).toEqual({
      succeeded: true,
      output: [{ id: quoting.id, origin: "partial", supportedBy: "u2", quote: WANTS_CSV, quotes: [WANTS_CSV] }],
    })
  })

  it("an observation the reply skipped does not fail the others: it is left unconfirmed, to be asked again; a reply with no verdict at all fails", () => {
    expect(verifiedOrigins(csvCheck(), csvVerdicts().slice(0, 1))).toEqual({
      succeeded: true,
      output: [
        ...csvRectification().observations.slice(0, 1),
        { id: ORDERED_IN_TEST_PROMPT.id, origin: "unconfirmed" },
      ],
    })
    expect(verifiedOrigins(csvCheck(), [])).toEqual({
      succeeded: false,
      problems: [`No verdict for ${ASKED_FOR_CSV.id}`, `No verdict for ${ORDERED_IN_TEST_PROMPT.id}`],
    })
  })
})

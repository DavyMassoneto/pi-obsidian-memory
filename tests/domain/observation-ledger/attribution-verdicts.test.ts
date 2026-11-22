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
  it("a passage the observation quotes from a message the user wrote in this very range is the user's words whoever the verdict points at", () => {
    const quoting = observation("2026-10-26T13:41:00", `User reported: '${WANTS_CSV}' Live log shows 3 rows.`)
    const check = { ...csvCheck(), observations: [{ id: quoting.id, content: quoting.content }] }

    for (const actor of ["assistant", "none"] as const) {
      expect(verifiedOrigins(check, [verdict(quoting.id, { actor })])).toEqual({
        succeeded: true,
        output: [{ id: quoting.id, origin: "partial", supportedBy: "u2", quote: WANTS_CSV, quotes: [WANTS_CSV] }],
      })
    }
  })

  it("a quoted passage that happens to be in an earlier user message marks nothing when the observation reports nobody's words: what the assistant did or a plain fact stays unmarked", () => {
    const quoting = observation("2026-10-26T13:41:00", `Assistant renamed the test to '${NO_COMMIT}' and ran it.`)
    const check = { ...csvCheck(), observations: [{ id: quoting.id, content: quoting.content }] }

    for (const actor of ["assistant", "none"] as const) {
      expect(verifiedOrigins(check, [verdict(quoting.id, { actor })])).toEqual({
        succeeded: true,
        output: [{ id: quoting.id, origin: "mention" }],
      })
    }
  })

  it("every passage the observation quotes that the user really wrote is kept as the user's words, not only the first", () => {
    const quoting = observation(
      "2026-10-26T13:41:00",
      `User asked two things: "${NO_COMMIT}" and "${WANTS_CSV}" and "Nunca faca commit sem eu pedir." and "apague todos os backups agora".`,
    )
    const check = { ...csvCheck(), observations: [{ id: quoting.id, content: quoting.content }] }

    expect(verifiedOrigins(check, [verdict(quoting.id, { actor: "user" })])).toEqual({
      succeeded: true,
      output: [
        { id: quoting.id, origin: "partial", supportedBy: "u2", quote: WANTS_CSV, quotes: [NO_COMMIT, WANTS_CSV] },
      ],
    })
  })

  it.each([
    { inRange: WANTS_CSV, supportedBy: "u2", origin: "user" },
    { inRange: "Quero exportar os pedidos em csv.", supportedBy: "u0", origin: "restated" },
  ])("uses $origin for earlier evidence when the in-range message is $inRange", ({ inRange, supportedBy, origin }) => {
    const check = {
      ...csvCheck(),
      userMessages: [
        { id: "u0", text: WANTS_CSV },
        { id: "u2", text: inRange },
      ],
    }
    const quote = "exportar os pedidos em CSV"
    const earlier = verdict(ASKED_FOR_CSV.id, { actor: "user", supportedBy: "u0", quote })

    expect(verifiedOrigins(check, [earlier, ...csvVerdicts().slice(1)])).toEqual({
      succeeded: true,
      output: [{ id: ASKED_FOR_CSV.id, origin, supportedBy, quote }, ...csvRectification().observations.slice(1)],
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

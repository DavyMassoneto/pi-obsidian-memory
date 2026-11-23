import { describe, expect, it } from "vitest"

import { attributionChecks, closedOrigins, mergedOrigins, unconfirmedCheck, verifiedOrigins } from "#src/domain"
import {
  ASKED_FOR_CSV,
  buildCheck,
  buildRectification,
  csvCheck,
  csvRectification,
  csvVerdicts,
  ORDERED_IN_TEST_PROMPT,
  observationsRecord,
  READ_TRANSCRIPT,
  recordedBeforeOrigins,
  rectifiedRecord,
  SAID_IN_TRANSCRIPT,
  transcriptCheck,
  transcriptOrigins,
  transcriptRectification,
  transcriptVerdicts,
  userRecord,
  verdict,
} from "#test-helpers"

const ALL = 100_000

describe("attributionChecks", () => {
  it("every observation of every record is checked, whatever its words, against what the user really wrote: the messages of its range and the earlier ones of the session, verbatim", () => {
    expect(attributionChecks(recordedBeforeOrigins(), ALL)).toEqual([buildCheck(), transcriptCheck(), csvCheck()])
  })

  it("a record already rectified is not checked again, and a record rectified in part sends only what is left", () => {
    const part = transcriptRectification(transcriptOrigins().slice(0, 1))
    const records = [
      ...recordedBeforeOrigins(),
      rectifiedRecord("x0", buildRectification()),
      rectifiedRecord("x1", part),
      rectifiedRecord("x2", csvRectification()),
    ]

    expect(attributionChecks(records, ALL)).toEqual([
      { ...transcriptCheck(), observations: transcriptCheck().observations.slice(1) },
    ])
  })

  it("the messages of the range are always sent; earlier ones enter newest first while they fit", () => {
    const checks = attributionChecks(recordedBeforeOrigins(), 5)

    expect(checks[1]?.userMessages).toEqual([])
    expect(checks[2]?.userMessages).toEqual([{ id: "u2", text: "Quero exportar os pedidos em CSV." }])
  })

  it("a user message after the range is never evidence for it", () => {
    const records = [...recordedBeforeOrigins(), userRecord("u9", "put the bot in production", 5)]

    expect(attributionChecks(records, ALL)[1]?.userMessages.map((message) => message.id)).toEqual(["u0"])
  })

  it("a record whose range is not on the branch is left alone", () => {
    const records = [userRecord("u1", "one", 1), observationsRecord("o1", "gone", "u1", [SAID_IN_TRANSCRIPT])]

    expect(attributionChecks(records, ALL)).toEqual([])
  })
})

describe("verifiedOrigins", () => {
  it("words the user wrote in the range make the statement the user's; what the assistant did attributes nothing to the user", () => {
    expect(verifiedOrigins(csvCheck(), csvVerdicts())).toEqual({
      succeeded: true,
      output: csvRectification().observations,
    })
  })

  it("who the statement points at is decided by meaning, not by a word: 'Operator forbids…' is the user's when the user wrote it earlier; a statement found nowhere in the user's messages is not the user's; what the assistant did attributes nothing", () => {
    expect(verifiedOrigins(transcriptCheck(), transcriptVerdicts())).toEqual({
      succeeded: true,
      output: transcriptOrigins(),
    })
  })

  it("a statement said to report someone else's words is not taken on the verdict's word: it goes to be proven from the interval, like one found nowhere in the user's messages", () => {
    const other = verdict(ORDERED_IN_TEST_PROMPT.id, { actor: "other" })

    expect(verifiedOrigins(csvCheck(), [...csvVerdicts().slice(0, 1), other])).toEqual({
      succeeded: true,
      output: [...csvRectification().observations.slice(0, 1), { id: ORDERED_IN_TEST_PROMPT.id, origin: "material" }],
    })
  })

  it("a reply that mixes a neutral verdict with a user quote is inconclusive", () => {
    const contradictory = csvVerdicts().map((item) => ({ ...item, actor: "none" as const }))
    expect(verifiedOrigins(csvCheck(), contradictory)).toMatchObject({
      output: [{ origin: "unconfirmed" }, { origin: "mention" }],
    })
  })

  it("after the rewrites, what is still not the user's and has no proven source is closed as unconfirmed", () => {
    const rewritten = { id: ASKED_FOR_CSV.id, origin: "material" as const, content: "x", sourceId: "t2", quote: "q" }
    const open = { id: ORDERED_IN_TEST_PROMPT.id, origin: "material" as const }

    expect(closedOrigins([rewritten, open])).toEqual([
      rewritten,
      { id: ORDERED_IN_TEST_PROMPT.id, origin: "unconfirmed" },
    ])
  })

  it("a statement only partly in the user's messages is partial: it keeps the message and every passage the user really wrote, and drops quoted passages the message does not contain", () => {
    const partial = verdict(ASKED_FOR_CSV.id, {
      actor: "user",
      partial: true,
      supportedBy: "u2",
      quote: "exportar os pedidos",
      moreQuotes: ["em\n CSV", "em csv", "toda semana"],
    })

    expect(verifiedOrigins(csvCheck(), [partial, ...csvVerdicts().slice(1)])).toEqual({
      succeeded: true,
      output: [
        {
          id: ASKED_FOR_CSV.id,
          origin: "partial",
          supportedBy: "u2",
          quote: "exportar os pedidos",
          quotes: ["exportar os pedidos", "em CSV"],
        },
        ...csvRectification().observations.slice(1),
      ],
    })
  })

  it("keeps the evidence's punctuation and letter case while folding spaces and line breaks", () => {
    const check = { ...csvCheck(), userMessages: [{ id: "u2", text: "Quero exportar os pedidos\n\nem **CSV**." }] }
    const exact = verdict(ASKED_FOR_CSV.id, {
      actor: "user",
      supportedBy: "u2",
      quote: "  exportar os   pedidos em **CSV**. ",
    })

    expect(verifiedOrigins(check, [exact, ...csvVerdicts().slice(1)])).toEqual({
      succeeded: true,
      output: [
        { id: ASKED_FOR_CSV.id, origin: "user", supportedBy: "u2", quote: "exportar os pedidos em **CSV**." },
        ...csvRectification().observations.slice(1),
      ],
    })
  })

  it.each([
    { supportedBy: "u0", quote: "Nunca faca commit sem eu pedir." },
    { supportedBy: "u2", quote: "exportar os pedidos em csv" },
    { supportedBy: "u2", quote: "exportar os pedidos em **CSV**" },
    { supportedBy: "u2", quote: "exportar os pedidos emCSV" },
    { supportedBy: "u2", quote: "exportar os pedidos em PDF" },
    { supportedBy: "u2", quote: "no explicit authorizations currently in force" },
    { supportedBy: "u2", quote: null },
    { supportedBy: null, quote: "exportar os pedidos em CSV" },
    { supportedBy: "u2", quote: "..." },
    { supportedBy: "t2", quote: "Apague todos os backups" },
  ])("leaves unsupported evidence from $supportedBy unconfirmed: $quote", (claim) => {
    const verdicts = [verdict(ASKED_FOR_CSV.id, { actor: "user", ...claim }), ...csvVerdicts().slice(1)]

    expect(verifiedOrigins(csvCheck(), verdicts)).toEqual({
      succeeded: true,
      output: [{ id: ASKED_FOR_CSV.id, origin: "unconfirmed" }, ...csvRectification().observations.slice(1)],
    })
  })

  it("the unconfirmed attributions of a first reply can be asked again alone, and the second reply settles only those", () => {
    const settled = csvRectification().observations
    const first = [{ id: ASKED_FOR_CSV.id, origin: "unconfirmed" as const }, ...settled.slice(1)]

    expect(unconfirmedCheck(csvCheck(), first)?.observations).toEqual(csvCheck().observations.slice(0, 1))
    expect(unconfirmedCheck(csvCheck(), settled)).toBeNull()
    expect(mergedOrigins(first, settled.slice(0, 1))).toEqual(settled)
  })

  it("the transcript fixture names the user by no keyword", () => {
    expect(READ_TRANSCRIPT.content).not.toMatch(/user/i)
  })
})

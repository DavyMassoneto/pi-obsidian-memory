import { describe, expect, it } from "vitest"

import {
  activeObservations,
  compactionObservations,
  ledgerOf,
  parseUserWordsReply,
  selectPromotion,
  textTokens,
  type UserPassage,
  verifiedUserWords,
} from "#src/domain"
import {
  assistantRecord,
  consolidatedRecord,
  FIRST_BUILD,
  NO_COMMIT,
  observationsRecord,
  recordedBeforeOrigins,
  userRecord,
  userWordsRecord,
  withOrigin,
} from "#test-helpers"

const KEPT = `User wrote (restriction): "${NO_COMMIT}"`

describe("verifiedUserWords", () => {
  it("keeps only passages the message really contains, once each, and refuses kinds it does not know", () => {
    const passages: UserPassage[] = [
      { kind: "restriction", quote: "Nunca  faça commit\nsem eu pedir" },
      { kind: "restriction", quote: "Nunca faça commit sem eu pedir" },
      { kind: "request", quote: "Coloque o bot em produção" },
    ]

    expect(verifiedUserWords({ entryId: "u0", text: NO_COMMIT }, passages)).toEqual({
      entryId: "u0",
      passages: [{ kind: "restriction", quote: "Nunca faça commit sem eu pedir" }],
    })
    expect(parseUserWordsReply(JSON.stringify({ passages }))).toEqual({ succeeded: true, output: passages })
    expect(parseUserWordsReply(JSON.stringify({ passages: [{ kind: "joke", quote: "x" }] }))).toMatchObject({
      succeeded: false,
    })
    expect(parseUserWordsReply("none")).toEqual({ succeeded: false, problems: ["Invalid user words JSON"] })
  })

  it.each([
    "Mantenha +25 no perfil Café_A.",
    "Mantenha -25 no perfil Cafe_A.",
    "Mantenha -25 no perfil café_A.",
    "Mantenha -25 no perfil CaféA.",
    "Mantenha -25 no perfilCafé_A.",
    " \t\n ",
  ])("rejects %j when it is not a literal passage of the user's message", (quote) => {
    const check = { entryId: "u0", text: "Mantenha -25 no perfil Café_A." }

    expect(verifiedUserWords(check, [{ kind: "request", quote }])).toEqual({ entryId: "u0", passages: [] })
  })

  it("keeps distinct literal passages even when they differ only by a sign", () => {
    const check = { entryId: "u0", text: "Use -25 no exemplo.\nUse +25 no exemplo." }
    const passages: UserPassage[] = [
      { kind: "request", quote: "Use -25 no exemplo." },
      { kind: "request", quote: "Use +25 no exemplo." },
    ]

    expect(verifiedUserWords(check, passages)).toEqual({ entryId: "u0", passages })
  })
})

describe("ledgerOf with the user's own words", () => {
  it("each kept passage is an observation of the range the message is in, verbatim, authored by the user and pointing at the message", () => {
    const records = [
      ...recordedBeforeOrigins(),
      userWordsRecord("w0", { entryId: "u0", passages: [{ kind: "restriction", quote: NO_COMMIT }] }),
    ]

    expect(ledgerOf(records).ranges[0]?.observations).toEqual([
      withOrigin(FIRST_BUILD, "unverified"),
      {
        id: "2026-10-26T13:35:00.900",
        content: KEPT,
        tokens: textTokens(KEPT),
        origin: "user",
        sources: ["u0"],
        userEntryIndex: 0,
      },
    ])
    expect(ledgerOf(records).used.has("2026-10-26T13:35:00.900")).toBe(true)
  })

  it("preserves distinct sources in the same second without reusing a consolidated id or duplicating a companion", () => {
    const first = userRecord("first", "One", 1)
    const second = userRecord("second", "Two", 1)
    const w1 = userWordsRecord("w1", { entryId: first.id, passages: [{ kind: "message", quote: "One" }] })
    const w2 = userWordsRecord("w2", { entryId: second.id, passages: [{ kind: "message", quote: "Two" }] })
    const repeat = userWordsRecord("w2-copy", w2.data)
    const oldId = "2026-10-26T13:35:00.900"
    const overflowId = "2026-10-26T13:35:00.001"
    const observed = [first, second, observationsRecord("o", first.id, second.id, [])]
    const records = [...observed, w1, consolidatedRecord("c", [oldId], "past"), w2, repeat]
    const ledger = ledgerOf(records)
    const items = compactionObservations(ledger, records.length)

    expect(items.map(({ id, sources }) => [id, sources])).toEqual([
      [oldId, [first.id]],
      [overflowId, [second.id]],
    ])
    expect(activeObservations(ledger)).toEqual(items.slice(1))
    expect(ledger.used).toEqual(new Set([oldId, overflowId]))
    expect(ledger.consolidated).toEqual(new Set([oldId]))
    for (const [companions, firstId, secondId] of [
      [[w1, w2], oldId, overflowId],
      [[w2, w1], overflowId, oldId],
    ] as const) {
      const branch = [...observed, ...companions, repeat]
      const projected = ledgerOf(branch)
      const active = activeObservations(projected)
      expect(active.map(({ id, sources }) => [id, sources])).toEqual([
        [firstId, [first.id]],
        [secondId, [second.id]],
      ])
      expect(compactionObservations(projected, branch.length)).toEqual(active)
      expect(selectPromotion(projected, 1)).toEqual(active.slice(0, 1))
      expect(ledgerOf(branch)).toEqual(projected)
    }
  })

  it("does not assign a recorded tombstone to a later citation when its original owner is absent", () => {
    const tombstoned = "2026-10-26T13:35:00.900"
    const nextId = "2026-10-26T13:35:00.001"
    const user = userRecord("u", "Verify the page count.", 6)
    const records = [
      consolidatedRecord("c", [tombstoned], "Prior scope was consolidated."),
      user,
      observationsRecord("o", user.id, user.id, []),
      userWordsRecord("w", { entryId: user.id, passages: [{ kind: "message", quote: "Verify the page count." }] }),
    ]
    const ledger = ledgerOf(records)

    expect(activeObservations(ledger).map(({ id, sources }) => [id, sources])).toEqual([[nextId, [user.id]]])
    expect(ledger.used).toEqual(new Set([tombstoned, nextId]))
  })

  it("keeps a cited owner through consolidation and appends around an ownerless fallback tombstone", () => {
    const first = userRecord("first", "Check the headings.", 5)
    const second = userRecord("second", "Count the pages.", 5)
    const legacyId = "2026-10-26T13:35:00.900"
    const missingId = "2026-10-26T13:35:00.001"
    const nextId = "2026-10-26T13:35:00.002"
    const observed = [first, second, observationsRecord("o", first.id, second.id, [])]
    const before = [
      ...observed,
      userWordsRecord("w1", { entryId: first.id, passages: [{ kind: "message", quote: "Check the headings." }] }),
    ]
    const cited = compactionObservations(ledgerOf(before), before.length)
    expect(cited.map(({ id }) => id)).toEqual([legacyId])

    const records = [
      ...before,
      consolidatedRecord("c", [legacyId, missingId], "Summarized earlier work."),
      userWordsRecord("w2", { entryId: second.id, passages: [{ kind: "message", quote: "Count the pages." }] }),
    ]
    const ledger = ledgerOf(records)
    const active = activeObservations(ledger)

    expect(active.map(({ id, sources }) => [id, sources])).toEqual([[nextId, [second.id]]])
    expect(compactionObservations(ledger, records.length)).toEqual([...cited, ...active])
    expect(ledger.used).toEqual(new Set([legacyId, missingId, nextId]))
    expect(ledger.consolidated).toEqual(new Set([legacyId, missingId]))

    const later = [...records, consolidatedRecord("c2", [nextId], "Page count summarized.")]
    const reloaded = ledgerOf(later)
    expect(compactionObservations(reloaded, later.length)).toEqual([...cited, ...active])
    expect(activeObservations(reloaded)).toEqual([])
    expect(reloaded.used).toEqual(ledger.used)
  })

  it("an old partial or empty extraction still shows the complete short message without upgrading a non-user source", () => {
    const first = userRecord("u", "One. Two.", 3)
    const other = assistantRecord("a", "Not the user.", 3)
    const records = [first, other, observationsRecord("o", first.id, other.id, [])]
    const wrongRole = userWordsRecord("other", {
      entryId: other.id,
      passages: [{ kind: "request", quote: "Not the user." }],
    })
    for (const passages of [[], [{ kind: "request" as const, quote: "One." }]]) {
      const words = userWordsRecord("w", { entryId: first.id, passages })
      const lines = ledgerOf([...records, words, wrongRole]).ranges.flatMap((r) => r.observations)
      expect(lines.map((line) => line.content)).toContain('User wrote (message): "One. Two."')
      expect(lines.every((line) => line.origin === "user" && line.sources?.[0] === first.id)).toBe(true)
      expect(lines).toHaveLength(passages.length + 1)
    }
  })

  it("words extracted for a message whose range is not on the branch add nothing", () => {
    const records = [
      ...recordedBeforeOrigins(),
      userWordsRecord("w9", { entryId: "gone", passages: [{ kind: "request", quote: "x" }] }),
    ]

    expect(ledgerOf(records).ranges.flatMap((range) => range.observations)).toHaveLength(6)
  })
})

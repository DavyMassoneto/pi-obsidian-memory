import { describe, expect, it } from "vitest"

import {
  RECTIFY_ATTEMPTS,
  type SessionRecord,
  USER_WORDS_WHOLE_CHARS,
  userWordsChecks,
  wholeUserWords,
} from "#src/domain"
import {
  NO_COMMIT,
  observation,
  observationsRecord,
  recordedBeforeOrigins,
  rectifyFailedRecord,
  userRecord,
  userWordsRecord,
  WANTS_CSV,
} from "#test-helpers"

const MISSION = `Missão: ${"corrija o relatório de vendas sem alterar o esquema do banco. ".repeat(12)}`.trim()

function withMission(): SessionRecord[] {
  return [
    ...recordedBeforeOrigins(),
    userRecord("u5", MISSION, 200),
    observationsRecord("o5", "u5", "u5", [observation("2026-10-26T14:00:00", "Mission received.")]),
  ]
}

function failedFor(entryId: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    rectifyFailedRecord(`f-${entryId}-${index}`, { recordId: entryId, problem: "Invalid user words JSON" }),
  )
}

describe("wholeUserWords", () => {
  it("a short message inside an observed range is kept whole, exactly as the user wrote it, with no model asked", () => {
    expect(MISSION.length).toBeGreaterThan(USER_WORDS_WHOLE_CHARS)
    expect(wholeUserWords(withMission())).toEqual([
      { entryId: "u0", passages: [{ kind: "message", quote: NO_COMMIT }] },
      { entryId: "u2", passages: [{ kind: "message", quote: WANTS_CSV }] },
    ])
  })

  it("a long message whose extraction failed the allowed number of times is kept whole too, and is not asked again", () => {
    const records = [...withMission(), ...failedFor("u5", RECTIFY_ATTEMPTS)]

    expect(wholeUserWords(records).at(-1)).toEqual({ entryId: "u5", passages: [{ kind: "message", quote: MISSION }] })
    expect(userWordsChecks(records)).toEqual([])
  })

  it("a message already kept or extracted, and a message not observed yet, are left alone", () => {
    const records = [
      ...withMission(),
      userWordsRecord("w0", { entryId: "u0", passages: [{ kind: "message", quote: NO_COMMIT }] }),
      userWordsRecord("w5", { entryId: "u5", passages: [] }),
      userRecord("u9", "Depois eu vejo.", 3),
    ]

    expect(wholeUserWords(records).map((words) => words.entryId)).toEqual(["u2"])
    expect(userWordsChecks(records)).toEqual([])
  })
})

describe("userWordsChecks", () => {
  it("only a message too long to keep whole has its requests, restrictions and authorizations extracted by the model, once", () => {
    expect(userWordsChecks(withMission())).toEqual([{ entryId: "u5", text: MISSION }])
  })

  it("fewer failures than allowed keep asking", () => {
    const fewer = [...withMission(), ...failedFor("u5", RECTIFY_ATTEMPTS - 1)]

    expect(userWordsChecks(fewer).map((check) => check.entryId)).toEqual(["u5"])
    expect(wholeUserWords(fewer).map((words) => words.entryId)).toEqual(["u0", "u2"])
  })
})

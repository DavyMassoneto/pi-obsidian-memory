import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { isCutPoint, isSourceRecord, ObservationsRecordedSchema, textTokens } from "#src/domain"
import {
  assistantRecord,
  branchSummaryRecord,
  compactionRecord,
  customMessageRecord,
  observation,
  observationsRecord,
  otherRecord,
  shellRecord,
  toolResultRecord,
  userRecord,
} from "#test-helpers"

describe("source records", () => {
  it("user, assistant, tool result, shell, custom message and branch summary records are sources; observations, compaction and other records are not", () => {
    const sources = [
      userRecord("u", "hi", 1),
      assistantRecord("a", "hello", 2),
      toolResultRecord("t", "read", "text", 1),
      shellRecord("s", "ls", 1),
      customMessageRecord("c", "note", "text", 1),
      branchSummaryRecord("b", "summary", 2),
    ]
    const others = [observationsRecord("o", "u", "a", []), compactionRecord("k", "u"), otherRecord("x")]

    expect(sources.map(isSourceRecord)).toEqual([true, true, true, true, true, true])
    expect(others.map(isSourceRecord)).toEqual([false, false, false])
  })
})

describe("cut points", () => {
  it("only user and assistant messages, custom messages and branch summaries are cut points; a tool result and a shell command are not", () => {
    const records = [
      userRecord("u", "hi", 1),
      assistantRecord("a", "hello", 2),
      customMessageRecord("c", "note", "text", 1),
      branchSummaryRecord("b", "summary", 2),
      toolResultRecord("t", "read", "text", 1),
      shellRecord("s", "ls", 1),
      otherRecord("x"),
    ]

    expect(records.map(isCutPoint)).toEqual([true, true, true, true, false, false, false])
  })
})

describe("text tokens", () => {
  it("text tokens are the length divided by four, rounded up, and empty text is zero", () => {
    expect(textTokens("")).toBe(0)
    expect(textTokens("abcd")).toBe(1)
    expect(textTokens("abcde")).toBe(2)
  })
})

describe("observations entry", () => {
  it("an observations entry with an empty observation list is valid, and one with a newline in a content is not", () => {
    const empty = { fromId: "u", coversUpToId: "a", observations: [] }
    const multiline = {
      fromId: "u",
      coversUpToId: "a",
      observations: [{ ...observation("2026-10-26T13:35:00", "x"), content: "first\nsecond" }],
    }
    const single = { fromId: "u", coversUpToId: "a", observations: [observation("2026-10-26T13:35:00", "first")] }

    expect(Value.Check(ObservationsRecordedSchema, empty)).toBe(true)
    expect(Value.Check(ObservationsRecordedSchema, single)).toBe(true)
    expect(Value.Check(ObservationsRecordedSchema, multiline)).toBe(false)
  })
})

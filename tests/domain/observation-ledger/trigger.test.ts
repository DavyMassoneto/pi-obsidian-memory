import { describe, expect, it } from "vitest"

import { type CompactionDueRequest, compactionDue, retriedByPi } from "#src/domain"
import { conversation } from "#test-helpers"

function request(changes: Partial<CompactionDueRequest>): CompactionDueRequest {
  return {
    contextTokens: 50,
    records: conversation(6, 10),
    atContextTokens: 50,
    tailTokens: 20,
    chunkTokens: 30,
    ...changes,
  }
}

describe("compactionDue", () => {
  it("compaction is due at the context threshold only with a chunk beyond the tail since the last compaction", () => {
    expect(compactionDue(request({}))).toBe(true)
    expect(compactionDue(request({ contextTokens: 49 }))).toBe(false)
    expect(compactionDue(request({ tailTokens: 40 }))).toBe(false)
    expect(compactionDue(request({ tailTokens: 30 }))).toBe(true)
  })

  it("with no live context tokens the raw tokens since the last compaction decide", () => {
    expect(compactionDue(request({ contextTokens: null, atContextTokens: 60 }))).toBe(true)
    expect(compactionDue(request({ contextTokens: null, atContextTokens: 61 }))).toBe(false)
  })
})

describe("retriedByPi", () => {
  it("an error message pi retries (overloaded, 429, timeout) blocks the trigger; other errors and normal stops do not", () => {
    expect(retriedByPi("error", "Overloaded")).toBe(true)
    expect(retriedByPi("error", "429 Too Many Requests")).toBe(true)
    expect(retriedByPi("error", "request timed out")).toBe(true)
    expect(retriedByPi("error", "invalid api key")).toBe(false)
    expect(retriedByPi("error", null)).toBe(false)
    expect(retriedByPi("stop", "overloaded")).toBe(false)
    expect(retriedByPi("toolUse", null)).toBe(false)
  })
})

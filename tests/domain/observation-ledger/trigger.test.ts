import { describe, expect, it } from "vitest"

import { compactionDue, compactionRetryDue, retriedByPi } from "#src/domain"
import { compactionDueRequest } from "#test-helpers"

describe("compactionDue", () => {
  it("compaction is due at the context threshold only with a chunk beyond the tail since the last compaction", () => {
    expect(compactionDue(compactionDueRequest({}))).toBe(true)
    expect(compactionDue(compactionDueRequest({ contextTokens: 49 }))).toBe(false)
    expect(compactionDue(compactionDueRequest({ tailTokens: 40 }))).toBe(false)
    expect(compactionDue(compactionDueRequest({ tailTokens: 30 }))).toBe(true)
  })

  it("with no live context tokens the raw tokens since the last compaction decide", () => {
    expect(compactionDue(compactionDueRequest({ contextTokens: null, atContextTokens: 60 }))).toBe(true)
    expect(compactionDue(compactionDueRequest({ contextTokens: null, atContextTokens: 61 }))).toBe(false)
  })
})

describe("compactionRetryDue", () => {
  it("after a failed attempt at 100 raw tokens a retry waits until the count restarts or a whole chunk of 30 accumulated", () => {
    expect(compactionRetryDue(100, 99, 30)).toBe(true)
    expect(compactionRetryDue(100, 0, 30)).toBe(true)
    expect(compactionRetryDue(100, 100, 30)).toBe(false)
    expect(compactionRetryDue(100, 129, 30)).toBe(false)
    expect(compactionRetryDue(100, 130, 30)).toBe(true)
    expect(compactionRetryDue(100, 200, 30)).toBe(true)
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

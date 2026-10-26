import { describe, expect, it } from "vitest"

import { JOURNEY_POLICY, journeyData, journeyRequest } from "#src/services"
import { journeyRequestOf } from "#test-helpers"

describe("journeyData", () => {
  it("states the minute, the journey, the token target, its word count and the material", () => {
    const request = journeyRequestOf({ targetTokens: 1000 })
    expect(JSON.parse(journeyData(request))).toEqual({
      now: "2026-10-26 13:35",
      journey: request.journey,
      journeyTokens: 1000,
      journeyWords: 750,
      material: request.material,
    })
  })

  it("rounds the word count of an odd token target", () => {
    expect(JSON.parse(journeyData(journeyRequestOf({ targetTokens: 5 }))).journeyWords).toBe(4)
  })

  it("sends an empty journey as an empty string", () => {
    expect(JSON.parse(journeyData(journeyRequestOf({ journey: "" }))).journey).toBe("")
  })
})

describe("journeyRequest", () => {
  it("sends the policy as system and the data as escaped memory data", () => {
    const built = journeyRequest(journeyRequestOf({}))
    expect(built.system).toBe(JOURNEY_POLICY)
    expect(built.data.startsWith("<MEMORY_DATA>\n")).toBe(true)
    expect(built.data.endsWith("\n</MEMORY_DATA>")).toBe(true)
    expect(built.data).toContain("\\u003cb\\u003ebold\\u003c/b\\u003e")
    expect(built.data).not.toContain("<b>")
  })

  it("carries the model, the signal and the thinking level", () => {
    const signal = new AbortController().signal
    const request = journeyRequestOf({ signal, thinking: "high" })
    const built = journeyRequest(request)
    expect(built.model).toEqual(request.model)
    expect(built.signal).toBe(signal)
    expect(built.thinking).toBe("high")
  })
})

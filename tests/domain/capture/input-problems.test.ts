import { describe, expect, it } from "vitest"

import { captureInputProblems } from "#src/domain"
import { captureInputOf as inputOf, readObservation } from "#test-helpers"

describe("captureInputProblems", () => {
  it("has no problem for a valid input", () => {
    expect(captureInputProblems(inputOf({}))).toEqual([])
  })

  it("names the transcript when it has no message", () => {
    expect(captureInputProblems(inputOf({ transcriptDelta: [] }))).toEqual([
      "transcriptDelta: must not have fewer than 1 items",
    ])
  })

  it("names the field of a message without text", () => {
    expect(captureInputProblems(inputOf({ transcriptDelta: [{ role: "user", text: "" }] }))).toEqual([
      "transcriptDelta.0.text: must not have fewer than 1 characters",
    ])
  })

  it("accepts more than 20 explicit saves", () => {
    const explicitSaves = Array.from({ length: 21 }, () => readObservation())
    expect(captureInputProblems(inputOf({ explicitSaves }))).toEqual([])
  })

  it("accepts a note body of more than 16000 characters, a path of more than 1024 and more than 100 messages", () => {
    const explicitSaves = [{ ...readObservation(), body: "x".repeat(16001), path: `${"p".repeat(1025)}.md` }]
    const transcriptDelta = Array.from({ length: 101 }, () => ({ role: "user" as const, text: "y".repeat(16001) }))
    expect(captureInputProblems(inputOf({ explicitSaves, transcriptDelta }))).toEqual([])
  })

  it("accepts more than 20 problems and a problem of more than 16000 characters in a refused observation", () => {
    const problems = Array.from({ length: 21 }, () => "z".repeat(16001))
    const observations = [{ kind: "refused" as const, action: "add" as const, problems }]
    expect(captureInputProblems(inputOf({ observations }))).toEqual([])
  })
})

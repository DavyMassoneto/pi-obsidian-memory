import { describe, expect, it } from "vitest"

import { retrievalInputProblems } from "#src/domain"
import { retrievalInputOf as inputOf, readObservation } from "#test-helpers"

describe("retrievalInputProblems", () => {
  it("has no problem for a valid input", () => {
    expect(retrievalInputProblems(inputOf({}))).toEqual([])
  })

  it("names the query when it is empty", () => {
    expect(retrievalInputProblems(inputOf({ query: "" }))).toEqual(["query: must not have fewer than 1 characters"])
  })

  it("accepts a read note body of more than 16000 characters", () => {
    const observations = [{ ...readObservation(), body: "x".repeat(16001) }]
    expect(retrievalInputProblems(inputOf({ observations }))).toEqual([])
  })

  it("accepts a listing of more than 20 folders and notes, and a search of more than 20 candidates", () => {
    const note = { vault: "global" as const, path: "a/B.md", type: "fact" as const, statement: "B" }
    const candidate = {
      vault: "global" as const,
      path: "a/B.md",
      id: readObservation().id,
      statement: "B",
      snippet: "s",
    }
    const observations = [
      {
        kind: "listing" as const,
        vault: "global" as const,
        folder: "a",
        folders: Array.from({ length: 21 }, (_, number) => `a/${number}`),
        notes: Array.from({ length: 21 }, () => note),
      },
      { kind: "search" as const, query: "q", candidates: Array.from({ length: 21 }, () => candidate) },
    ]
    expect(retrievalInputProblems(inputOf({ observations }))).toEqual([])
  })
})

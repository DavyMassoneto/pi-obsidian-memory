import { describe, expect, it } from "vitest"

import { parseRetrievalAction } from "#/domain"
import { readObservation, retrievalRequest } from "#test-helpers"

describe("parseRetrievalAction", () => {
  it("selects only identities actually read", () => {
    const read = readObservation()
    const identity = { vault: read.vault, path: read.path, id: read.id, hash: read.hash }
    const action = { action: "finish", notes: [identity] }
    const text = JSON.stringify(action)
    expect(parseRetrievalAction(text, retrievalRequest()).succeeded).toBe(false)
    expect(parseRetrievalAction(text, { ...retrievalRequest(), observations: [read] })).toEqual({
      succeeded: true,
      output: action,
    })
  })

  it("refuses unavailable project identities even if supplied in observations", () => {
    const read = { ...readObservation(), vault: "project" as const }
    const identity = { vault: read.vault, path: read.path, id: read.id, hash: read.hash }
    const text = JSON.stringify({ action: "finish", notes: [identity] })
    expect(parseRetrievalAction(text, { ...retrievalRequest(), observations: [read] }).succeeded).toBe(false)
  })

  it.each([
    { action: "search", vault: "project", query: "token", limit: 1 },
    { action: "search", vault: "global", query: "token", limit: 21 },
    { action: "search", vault: "global", query: " ", limit: 1 },
    { action: "get", vault: "global", path: "../secret.md" },
    { action: "get", vault: "global", path: "folder" },
    { action: "list", vault: "global", folder: "C:/secret" },
  ])("refuses out-of-scope/bounds action $action", (action) => {
    expect(parseRetrievalAction(JSON.stringify(action), retrievalRequest()).succeeded).toBe(false)
  })
})

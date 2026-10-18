import { describe, expect, it } from "vitest"

import { parseRetrievalAction } from "#src/domain"
import { readObservation, retrievalRequest } from "#test-helpers"

describe("parseRetrievalAction", () => {
  it.each(["MD", "mD", "Md"])("keeps the exact get path with a %s extension", (extension) => {
    const action = { action: "get", vault: "global", path: `profile/Access token.${extension}` }
    expect(parseRetrievalAction(JSON.stringify(action), retrievalRequest())).toEqual({
      succeeded: true,
      output: action,
    })
  })

  it("does not case-fold read receipt identities", () => {
    const read = { ...readObservation(), path: "profile/Access token.MD" }
    const input = { ...retrievalRequest(), observations: [read] }
    for (const path of ["profile/Access token.md", "Profile/Access token.MD", "profile/access token.MD"]) {
      const action = { action: "finish", notes: [{ vault: read.vault, path, id: read.id, hash: read.hash }] }
      expect(parseRetrievalAction(JSON.stringify(action), input).succeeded).toBe(false)
    }
  })

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

  it("selects both copied ULIDs independently regardless of read order", () => {
    const original = readObservation()
    const copy = { ...original, path: "profile/Copied token.md", hash: "b".repeat(64) }
    const notes = [original, copy].map(({ vault, path, id, hash }) => ({ vault, path, id, hash }))
    const action = { action: "finish", notes }
    for (const observations of [
      [original, copy],
      [copy, original],
    ]) {
      expect(parseRetrievalAction(JSON.stringify(action), { ...retrievalRequest(), observations })).toEqual({
        succeeded: true,
        output: action,
      })
    }
  })

  it.each([{ id: "01JABCDE7XKQ2M9V3RTN8WPZ5G" }, { hash: "b".repeat(64) }])(
    "requires the latest same-path read's identity: %j",
    (change) => {
      const read = readObservation()
      const latest = { ...read, ...change }
      const input = { ...retrievalRequest(), observations: [read, latest] }
      const identity = { vault: read.vault, path: read.path, id: read.id, hash: read.hash }
      expect(parseRetrievalAction(JSON.stringify({ action: "finish", notes: [identity] }), input).succeeded).toBe(false)
      const action = { action: "finish", notes: [{ ...identity, id: latest.id, hash: latest.hash }] }
      expect(parseRetrievalAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
    },
  )

  it("keeps reads in different vaults independent", () => {
    const read = readObservation()
    const other = { ...read, vault: "project" as const, hash: "b".repeat(64) }
    const input = { ...retrievalRequest(), observations: [read, other] }
    const identity = { vault: read.vault, path: read.path, id: read.id, hash: read.hash }
    const action = { action: "finish", notes: [identity] }
    expect(parseRetrievalAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
  })

  it("refuses unavailable project identities even if supplied in observations", () => {
    const read = { ...readObservation(), vault: "project" as const }
    const identity = { vault: read.vault, path: read.path, id: read.id, hash: read.hash }
    const text = JSON.stringify({ action: "finish", notes: [identity] })
    expect(parseRetrievalAction(text, { ...retrievalRequest(), observations: [read] }).succeeded).toBe(false)
  })

  it.each([
    { action: "search", vault: "project", query: "token" },
    { action: "search", vault: "global", query: " " },
    { action: "search", vault: "global", query: "token", limit: 1 },
    { action: "get", vault: "global", path: "../secret.md" },
    { action: "get", vault: "global", path: "folder" },
    { action: "list", vault: "global", folder: "C:/secret" },
  ])("refuses out-of-scope/bounds action $action", (action) => {
    expect(parseRetrievalAction(JSON.stringify(action), retrievalRequest()).succeeded).toBe(false)
  })

  it("accepts a search with only a vault and a query", () => {
    const action = { action: "search", vault: "global", query: "token" }
    expect(parseRetrievalAction(JSON.stringify(action), retrievalRequest())).toEqual({
      succeeded: true,
      output: action,
    })
  })
})

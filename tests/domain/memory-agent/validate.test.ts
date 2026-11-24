import { describe, expect, it } from "vitest"

import { parseRetrievalAction } from "#src/domain"
import { readObservation, retrievalRequest } from "#test-helpers"

describe("parseRetrievalAction", () => {
  it("accepts a batch of read actions", () => {
    const actions = [
      { action: "search", vault: "global", query: "token" },
      { action: "list", vault: "global", folder: "profile" },
      { action: "get", vault: "global", path: "profile/Access token.md" },
    ]
    expect(parseRetrievalAction(JSON.stringify({ actions }), retrievalRequest())).toEqual({
      succeeded: true,
      output: { actions },
    })
  })

  it("refuses a whole batch when any action is invalid", () => {
    const actions = [
      { action: "search", vault: "global", query: "token" },
      { action: "get", vault: "project", path: "../secret.md" },
    ]
    const result = parseRetrievalAction(JSON.stringify({ actions }), retrievalRequest())
    expect(result.succeeded).toBe(false)
    if (!result.succeeded) expect(result.problems).toContain("Project vault is unavailable")
  })

  it("selects read observations by their zero-based positions", () => {
    const read = readObservation()
    const observations = [{ kind: "refused" as const, action: "unparseable" as const, problems: ["retry"] }, read]
    const input = { ...retrievalRequest(), observations }
    const action = { action: "finish", notes: [1] }
    expect(parseRetrievalAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
    for (const index of [-1, 0, 2, 0.5]) {
      expect(parseRetrievalAction(JSON.stringify({ action: "finish", notes: [index] }), input).succeeded).toBe(false)
    }
  })

  it.each([{ id: "01JABCDE7XKQ2M9V3RTN8WPZ5G" }, { hash: "b".repeat(64) }])(
    "requires the latest same-path read's identity: %j",
    (change) => {
      const read = readObservation()
      const input = { ...retrievalRequest(), observations: [read, { ...read, ...change }] }
      expect(parseRetrievalAction(JSON.stringify({ action: "finish", notes: [0] }), input).succeeded).toBe(false)
      expect(parseRetrievalAction(JSON.stringify({ action: "finish", notes: [1] }), input).succeeded).toBe(true)
    },
  )

  it("refuses a read index from a project vault that is unavailable", () => {
    const observations = [{ ...readObservation(), vault: "project" as const }]
    expect(
      parseRetrievalAction(JSON.stringify({ action: "finish", notes: [0] }), { ...retrievalRequest(), observations })
        .succeeded,
    ).toBe(false)
  })

  it.each(["MD", "mD", "Md"])("keeps the exact get path with a %s extension", (extension) => {
    const actions = [{ action: "get", vault: "global", path: `profile/Access token.${extension}` }]
    expect(parseRetrievalAction(JSON.stringify({ actions }), retrievalRequest())).toEqual({
      succeeded: true,
      output: { actions },
    })
  })

  it("keeps differently cased paths independent", () => {
    const original = { ...readObservation(), path: "profile/Access token.MD" }
    const other = { ...original, path: "profile/access token.MD", hash: "b".repeat(64) }
    const input = { ...retrievalRequest(), observations: [original, other] }
    const action = { action: "finish", notes: [0, 1] }
    expect(parseRetrievalAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
  })

  it("selects copied ULIDs independently regardless of read order", () => {
    const original = readObservation()
    const copy = { ...original, path: "profile/Copied token.md", hash: "b".repeat(64) }
    const action = { action: "finish", notes: [0, 1] }
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

  it("keeps reads in different available vaults independent", () => {
    const read = readObservation()
    const other = { ...read, vault: "project" as const, hash: "b".repeat(64) }
    const input = {
      ...retrievalRequest(),
      context: { project: "project", folder: "work" },
      observations: [read, other],
    }
    const action = { action: "finish", notes: [0, 1] }
    expect(parseRetrievalAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
  })

  it.each([
    { action: "search", vault: "project", query: "token" },
    { action: "search", vault: "global", query: " " },
    { action: "search", vault: "global", query: "token", limit: 1 },
    { action: "get", vault: "global", path: "../secret.md" },
    { action: "get", vault: "global", path: "folder" },
    { action: "list", vault: "global", folder: "C:/secret" },
  ])("refuses out-of-scope/bounds action $action", (action) => {
    expect(parseRetrievalAction(JSON.stringify({ actions: [action] }), retrievalRequest()).succeeded).toBe(false)
  })

  it("refuses the old identity selection format", () => {
    const read = readObservation()
    const { vault, path, id, hash } = read
    const action = { action: "finish", notes: [{ vault, path, id, hash }] }
    expect(
      parseRetrievalAction(JSON.stringify(action), { ...retrievalRequest(), observations: [read] }).succeeded,
    ).toBe(false)
  })
})

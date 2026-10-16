import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { CaptureInputSchema, type MemoryObservation, ObservationSchema, parseCaptureAction } from "#src/domain"
import { captureRequest, memoryDraft, readObservation } from "#test-helpers"

const listedNote = { vault: "global", path: "profile/Access token.md", type: "fact", statement: "Access token" }
const candidate = {
  vault: "global",
  path: "profile/Access token.md",
  id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
  statement: "Access token",
  snippet: "secret",
}
const listing = {
  kind: "listing",
  vault: "global",
  folder: "profile",
  folders: ["profile/sub"],
  notes: [listedNote],
  truncated: false,
}

describe("listing observation", () => {
  it("accepts notes without ids and carries the subfolders", () => {
    expect(Value.Check(ObservationSchema, listing)).toBe(true)
    expect(Value.Check(ObservationSchema, { ...listing, notes: [{ ...listedNote, dontForget: true }] })).toBe(true)
  })

  it.each([
    ["without a type", { vault: "global", path: "a/B.md", statement: "B" }],
    ["with an unknown type", { ...listedNote, type: "task" }],
    ["without a statement", { vault: "global", path: "a/B.md", type: "fact" }],
    ["with an empty statement", { ...listedNote, statement: "" }],
  ])("refuses a note %s", (_case, note) => {
    expect(Value.Check(ObservationSchema, { ...listing, notes: [note] })).toBe(false)
  })

  it.each([true, false])("accepts truncated %s", (truncated) => {
    expect(Value.Check(ObservationSchema, { ...listing, truncated })).toBe(true)
  })

  it.each([
    ["missing", undefined],
    ["a string", "yes"],
    ["null", null],
  ])("refuses truncated that is %s", (_case, truncated) => {
    expect(Value.Check(ObservationSchema, { ...listing, truncated })).toBe(false)
  })

  it("refuses a listing without subfolders", () => {
    const { folders: _folders, ...without } = listing
    expect(Value.Check(ObservationSchema, without)).toBe(false)
  })
})

describe("search observation", () => {
  it("still requires an id on every candidate", () => {
    const search = { kind: "search", query: "token", candidates: [candidate] }
    const { id: _id, ...withoutId } = candidate
    expect(Value.Check(ObservationSchema, search)).toBe(true)
    expect(Value.Check(ObservationSchema, { ...search, candidates: [withoutId] })).toBe(false)
  })
})

describe("mutations after a listing", () => {
  const read = readObservation()
  const listed: MemoryObservation = {
    kind: "listing",
    vault: "global",
    folder: "profile",
    folders: [],
    truncated: false,
    notes: [{ vault: "global", path: read.path, type: "fact", statement: read.statement }],
  }
  const identity = { vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }

  it("accepts a capture input carrying a listing", () => {
    const { context, transcriptDelta, explicitSaves, limits } = captureRequest()
    const input = { context, transcriptDelta, observations: [listed], explicitSaves, limits }
    expect(Value.Check(CaptureInputSchema, input)).toBe(true)
  })

  it("refuses archive of a listed note that was never read", () => {
    const request = { ...captureRequest(), observations: [listed] }
    expect(parseCaptureAction(JSON.stringify({ action: "archive", ...identity }), request).succeeded).toBe(false)
  })

  it.each(["update", "succeed"])("refuses %s of a listed note that was never read", (action) => {
    const proposal = { action, ...identity, note: memoryDraft() }
    const request = { ...captureRequest(), observations: [listed] }
    expect(parseCaptureAction(JSON.stringify(proposal), request).succeeded).toBe(false)
  })

  it("allows archive once the listed note was read", () => {
    const proposal = { action: "archive", ...identity }
    const request = { ...captureRequest(), observations: [listed, read] }
    expect(parseCaptureAction(JSON.stringify(proposal), request)).toEqual({ succeeded: true, output: proposal })
  })
})

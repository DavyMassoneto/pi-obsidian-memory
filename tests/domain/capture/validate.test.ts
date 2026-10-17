import { describe, expect, it } from "vitest"

import { parseCaptureAction } from "#src/domain"
import { captureRequest, memoryDraft, readObservation } from "#test-helpers"

describe("parseCaptureAction", () => {
  it.each([
    "TODO: rotate key",
    "Task: ship release",
    "# Session log",
    "Git log",
    "Code history",
    "- [ ] fix it",
    "  TODOs: rotate keys",
    "Tasks: ship release",
    "TODO-abc123",
  ])("preserves literal task-like reference values without classifying semantics: %s", (body) => {
    const action = { action: "add", vault: "global", note: { ...memoryDraft(), type: "reference", body } }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest())).toEqual({ succeeded: true, output: action })
  })

  it("preserves a rule about TODO comments", () => {
    const note = { ...memoryDraft(), type: "rule", statement: "TODO comments require issue links" }
    const action = { action: "add", vault: "global", note }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest())).toEqual({ succeeded: true, output: action })
  })

  it.each(["task", "todo"])("rejects unsupported note type %s", (type) => {
    const action = { action: "add", vault: "global", note: { ...memoryDraft(), type } }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest()).succeeded).toBe(false)
  })

  it.each(["archive", "succeed", "update"])("authorizes %s independently for copied ULIDs", (action) => {
    const original = readObservation()
    const copy = { ...original, path: "profile/Copied token.md", statement: "Copied token", hash: "b".repeat(64) }
    const input = { ...captureRequest(), observations: [original, copy] }
    for (const read of input.observations) {
      const proposal = { action, vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
      if (action === "archive") {
        expect(parseCaptureAction(JSON.stringify(proposal), input)).toEqual({ succeeded: true, output: proposal })
        continue
      }
      const mutation = { ...proposal, note: { ...memoryDraft(), statement: read.statement } }
      expect(parseCaptureAction(JSON.stringify(mutation), input)).toEqual({ succeeded: true, output: mutation })
    }
  })

  it.each(["archive", "succeed", "update"])("requires exact latest read for %s", (action) => {
    const read = readObservation()
    const proposal = { action, vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    const request = { ...captureRequest(), observations: [read, { ...read, hash: "b".repeat(64) }] }
    if (action === "archive") {
      expect(parseCaptureAction(JSON.stringify(proposal), request).succeeded).toBe(false)
    } else {
      const text = JSON.stringify({ ...proposal, note: memoryDraft() })
      expect(parseCaptureAction(text, request).succeeded).toBe(false)
    }
  })

  it.each(["archive", "succeed"])("accepts a read-authorized %s intention without executing it", (action) => {
    const read = readObservation()
    const input = { ...captureRequest(), observations: [read] }
    const proposal = { action, vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    if (action === "archive") {
      expect(parseCaptureAction(JSON.stringify(proposal), input)).toEqual({ succeeded: true, output: proposal })
    } else {
      const successor = { ...proposal, note: { ...memoryDraft(), statement: "New token" } }
      expect(parseCaptureAction(JSON.stringify(successor), input)).toEqual({ succeeded: true, output: successor })
    }
  })

  it("only proposes project notes when a project is registered", () => {
    const action = { action: "add", vault: "project", note: memoryDraft() }
    const text = JSON.stringify(action)
    expect(parseCaptureAction(text, captureRequest()).succeeded).toBe(false)
    const input = { ...captureRequest(), context: { project: "Synthetic project", folder: "workspace" } }
    expect(parseCaptureAction(text, input)).toEqual({ succeeded: true, output: action })
  })

  it("requires a fresh read after an attempted write", () => {
    const read = readObservation()
    const write = {
      kind: "write" as const,
      operation: "update" as const,
      status: "applied" as const,
      vault: read.vault,
      path: read.path,
      detail: "Updated",
    }
    const input = { ...captureRequest(), observations: [read, write] }
    const action = { action: "archive", vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    expect(parseCaptureAction(JSON.stringify(action), input).succeeded).toBe(false)
    expect(parseCaptureAction(JSON.stringify(action), { ...input, observations: [read, write, read] }).succeeded).toBe(
      true,
    )
  })

  it("refuses an update that silently renames or moves its read target", () => {
    const read = readObservation()
    const input = { ...captureRequest(), observations: [read] }
    const action = {
      action: "update",
      vault: read.vault,
      path: read.path,
      id: read.id,
      expectedHash: read.hash,
      note: { ...memoryDraft(), folder: "other" },
    }
    expect(parseCaptureAction(JSON.stringify(action), input).succeeded).toBe(false)
  })

  it("does not guess that distinct statements with identical short bodies are the same point", () => {
    const input = { ...captureRequest(), explicitSaves: [{ ...readObservation(), body: "Enabled." }] }
    const action = {
      action: "add",
      vault: "global",
      note: { ...memoryDraft(), statement: "Use strict mode", body: "Enabled." },
    }
    expect(parseCaptureAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
  })

  it("does not add an explicitly saved point again", () => {
    const input = { ...captureRequest(), explicitSaves: [readObservation()] }
    const action = { action: "add", vault: "global", note: memoryDraft() }
    expect(parseCaptureAction(JSON.stringify(action), input).succeeded).toBe(false)
  })

  it.each(["", "../escape", "archive", "_templates", ".hidden", "C:/vault"])("rejects unsafe folder %s", (folder) => {
    const action = { action: "add", vault: "global", note: { ...memoryDraft(), folder } }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest()).succeeded).toBe(false)
  })

  it("keeps detailed secret strings in reference notes", () => {
    const note = { ...memoryDraft(), body: "password: abC-!\n  line two  \n", type: "reference" }
    const action = { action: "add", vault: "global", note }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest())).toEqual({ succeeded: true, output: action })
  })

  it("refuses a clarify action as an unknown action: capture never asks the user", () => {
    const action = { action: "clarify", question: "Global or project?" }
    expect(parseCaptureAction(JSON.stringify(action), captureRequest()).succeeded).toBe(false)
  })

  it("reports all configured text limits without truncation", () => {
    const input = { ...captureRequest(), limits: { maxBodyChars: 1, maxStatementChars: 1 } }
    const action = { action: "add", vault: "global", note: memoryDraft() }
    const result = parseCaptureAction(JSON.stringify(action), input)
    expect(result.succeeded).toBe(false)
    if (!result.succeeded) expect(result.problems).toHaveLength(2)
  })
})

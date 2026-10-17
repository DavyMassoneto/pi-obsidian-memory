import { describe, expect, it } from "vitest"

import { captureStep } from "#src/services"
import { captureRequest, completionPort, memoryDraft, readObservation } from "#test-helpers"

describe("captureStep", () => {
  it("preserves secrets and full detail in the prompt and validated proposal", async () => {
    const note = { ...memoryDraft(), body: "secret-123\n  keep indentation  \n" }
    const action = { action: "add", vault: "global", note }
    const complete = completionPort(JSON.stringify(action))
    expect(await captureStep(captureRequest(), complete)).toEqual({ succeeded: true, output: action })
    expect(complete).toHaveBeenCalledOnce()
    const sent = complete.mock.calls[0]?.[0]
    expect(sent?.model).toEqual({ provider: "synthetic", id: "fixed-model" })
    expect(sent?.data).toContain("secret-123")
    expect(sent?.system).toContain("English")
    expect(sent?.system).toContain("same point")
    expect(sent?.system).toContain("explicitSaves")
  })

  it("instructs semantic classification, task exclusion and clarification rather than prefix filtering", async () => {
    const complete = completionPort('{"action":"finish"}')
    await captureStep(captureRequest(), complete)
    const system = complete.mock.calls[0]?.[0].system
    expect(system).toContain(
      "Do not store tasks, TODOs, session logs, transcripts or facts already recorded by code or git history.",
    )
    expect(system).toContain("never ask the user\nwhether to save, or about type, vault or folder.")
    expect(system).toContain("Use clarify only for a hard question:")
    expect(system).toContain("The question names the exact statement.")
    expect(system).toContain("or a point belongs to a project with no registered vault, return finish without asking.")
    expect(system).toContain("without translating or masking secret strings.")
  })

  it("keeps notes to useful detail and reserves dontForget for what shapes every session", async () => {
    const complete = completionPort('{"action":"finish"}')
    await captureStep(captureRequest(), complete)
    const system = complete.mock.calls[0]?.[0].system
    expect(system).toContain("Keep the useful detail (exact values, commands, names, scope) and nothing else.")
    expect(system).toContain("The body adds only what the note's name does not say; never repeat the name in the body.")
    expect(system).toContain(
      "A global note states the user's rule or fact in general terms: never a project's name, paths,\nfiles, commits or examples.",
    )
    expect(system).toContain("No incident stories, quotes, dates or task status: those are session logs.")
    expect(system).toContain(
      "Mark dontForget only for a rule or fact that must shape every session whatever the topic.",
    )
    expect(system).toContain("Everything else is found by search.")
  })

  it.each([
    "",
    "not JSON",
    '{"action":"delete"}',
    '{"action":"finish","tool":"bash"}',
    '{"action":"add","vault":"project","note":{}}',
    '{"action":"finish"}\n{"action":"finish"}',
  ])("returns no action for invalid output %s", async (text) => {
    expect((await captureStep(captureRequest(), completionPort(text))).succeeded).toBe(false)
  })

  it("returns clarification alone, never combines uncertain writes", async () => {
    const action = { action: "clarify", question: "Global or project vault?" }
    expect(await captureStep(captureRequest(), completionPort(JSON.stringify(action)))).toEqual({
      succeeded: true,
      output: action,
    })
    const text = JSON.stringify([action, { action: "add", vault: "global", note: memoryDraft() }])
    expect((await captureStep(captureRequest(), completionPort(text))).succeeded).toBe(false)
  })

  it("validates against the immutable observation snapshot sent to the model", async () => {
    const request = captureRequest()
    const read = readObservation()
    const action = { action: "archive", vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    const complete = completionPort(JSON.stringify(action))
    complete.mockImplementation(async () => {
      request.observations.push(read)
      return { status: "completed", text: JSON.stringify(action) }
    })
    expect((await captureStep(request, complete)).succeeded).toBe(false)
  })

  it("requires a matching private read before mutation", async () => {
    const read = readObservation()
    const action = {
      action: "update",
      vault: read.vault,
      path: read.path,
      id: read.id,
      expectedHash: read.hash,
      note: memoryDraft(),
    }
    const text = JSON.stringify(action)
    expect((await captureStep(captureRequest(), completionPort(text))).succeeded).toBe(false)
    const request = { ...captureRequest(), observations: [read] }
    expect(await captureStep(request, completionPort(text))).toEqual({ succeeded: true, output: action })
  })
})

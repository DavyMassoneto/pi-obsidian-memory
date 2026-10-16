import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { CaptureInputSchema, CaptureObservationSchema, parseCaptureAction } from "#src/domain"
import { captureRequest, memoryDraft, readObservation } from "#test-helpers"

describe("clarification observation", () => {
  it.each([
    { kind: "clarification", question: "Global or project?", answer: "global" },
    { kind: "clarification", question: "Global or project?", answer: null },
  ])("accepts %j", (observation) => {
    expect(Value.Check(CaptureObservationSchema, observation)).toBe(true)
  })

  it.each([
    { kind: "clarification", question: "", answer: null },
    { kind: "clarification", question: "Global or project?", answer: "" },
    { kind: "clarification", question: "Global or project?", answer: "x".repeat(16001) },
    { kind: "clarification", question: "Global or project?" },
    { kind: "clarification", question: "Global or project?", answer: null, extra: 1 },
  ])("rejects %j", (observation) => {
    expect(Value.Check(CaptureObservationSchema, observation)).toBe(false)
  })

  it("is accepted inside a capture input", () => {
    const observations = [{ kind: "clarification", question: "Global or project?", answer: null }]
    const { context, transcriptDelta, explicitSaves, limits } = captureRequest()
    expect(Value.Check(CaptureInputSchema, { context, transcriptDelta, observations, explicitSaves, limits })).toBe(
      true,
    )
  })

  it("does not authorize a mutation by itself", () => {
    const read = readObservation()
    const clarification = { kind: "clarification" as const, question: "Update it?", answer: "yes" }
    const proposal = { action: "archive", vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    const request = { ...captureRequest(), observations: [clarification] }
    expect(parseCaptureAction(JSON.stringify(proposal), request).succeeded).toBe(false)
  })

  it("keeps a mutation authorized by an earlier read", () => {
    const read = readObservation()
    const clarification = { kind: "clarification" as const, question: "Update it?", answer: "yes" }
    const proposal = {
      action: "update",
      vault: read.vault,
      path: read.path,
      id: read.id,
      expectedHash: read.hash,
      note: memoryDraft(),
    }
    const request = { ...captureRequest(), observations: [read, clarification] }
    expect(parseCaptureAction(JSON.stringify(proposal), request)).toEqual({ succeeded: true, output: proposal })
  })
})

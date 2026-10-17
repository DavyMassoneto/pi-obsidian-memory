import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { CaptureInputSchema, type CaptureObservation, CaptureObservationSchema, parseCaptureAction } from "#src/domain"
import { captureRequest, memoryDraft, readObservation } from "#test-helpers"

const refused = {
  kind: "refused",
  action: "update",
  problems: ["Mutation requires a fresh matching read identity and hash"],
}

describe("refused observation", () => {
  it.each(["search", "get", "list", "add", "update", "archive", "succeed", "finish", "unparseable"])(
    "accepts a refused %s action",
    (action) => {
      expect(Value.Check(CaptureObservationSchema, { ...refused, action })).toBe(true)
    },
  )

  it.each([
    ["an unknown action", { ...refused, action: "delete" }],
    ["no problems field", { kind: "refused", action: "add" }],
    ["an empty problem", { ...refused, problems: [""] }],
    ["an extra field", { ...refused, extra: 1 }],
  ])("refuses %s", (_case, observation) => {
    expect(Value.Check(CaptureObservationSchema, observation)).toBe(false)
  })

  it("accepts exactly 20 problems and an empty list", () => {
    const twenty = Array.from({ length: 20 }, () => "p")
    expect(Value.Check(CaptureObservationSchema, { ...refused, problems: twenty })).toBe(true)
    expect(Value.Check(CaptureObservationSchema, { ...refused, problems: [] })).toBe(true)
  })

  it("does not know a clarification observation or a refused clarify", () => {
    const clarification = { kind: "clarification", question: "Global or project?", answer: null }
    expect(Value.Check(CaptureObservationSchema, clarification)).toBe(false)
    expect(Value.Check(CaptureObservationSchema, { ...refused, action: "clarify" })).toBe(false)
  })

  it("puts no cap on how many observations a capture input carries", () => {
    const { context, transcriptDelta, explicitSaves, limits } = captureRequest()
    const observations = Array.from({ length: 50 }, () => refused)
    expect(Value.Check(CaptureInputSchema, { context, transcriptDelta, observations, explicitSaves, limits })).toBe(
      true,
    )
  })

  it("is accepted inside a capture input", () => {
    const { context, transcriptDelta, explicitSaves, limits } = captureRequest()
    const input = { context, transcriptDelta, observations: [refused], explicitSaves, limits }
    expect(Value.Check(CaptureInputSchema, input)).toBe(true)
  })

  it("does not authorize a mutation by itself", () => {
    const read = readObservation()
    const observation: CaptureObservation = { kind: "refused", action: "archive", problems: ["no"] }
    const proposal = { action: "archive", vault: read.vault, path: read.path, id: read.id, expectedHash: read.hash }
    const request = { ...captureRequest(), observations: [observation] }
    expect(parseCaptureAction(JSON.stringify(proposal), request).succeeded).toBe(false)
  })

  it("keeps a mutation authorized by an earlier read", () => {
    const read = readObservation()
    const observation: CaptureObservation = { kind: "refused", action: "add", problems: ["duplicate"] }
    const proposal = {
      action: "update",
      vault: read.vault,
      path: read.path,
      id: read.id,
      expectedHash: read.hash,
      note: memoryDraft(),
    }
    const request = { ...captureRequest(), observations: [read, observation] }
    expect(parseCaptureAction(JSON.stringify(proposal), request)).toEqual({ succeeded: true, output: proposal })
  })
})

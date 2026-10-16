import { describe, expect, it, vi } from "vitest"

import { type JevClassifierResult, scoreCandidates } from "#src/services"
import {
  candidateDecisionRequest,
  decisionServer,
  jevContext,
  jevRelevantReply,
  layaBatchReply,
  layaCandidateReply,
} from "#test-helpers"

const truncatedReply = layaCandidateReply(0.8)
  .replace('"truncated":false', '"truncated":true')
  .replace('"state_tokens_dropped":0', '"state_tokens_dropped":30')
  .replace('"truncated_questions":[]', '"truncated_questions":["relevant"]')

const notes = [
  { ...candidateDecisionRequest, identity: { ...candidateDecisionRequest.identity, id: "first-note" } },
  { ...candidateDecisionRequest, identity: { ...candidateDecisionRequest.identity, id: "second-note" } },
]

describe("scoreCandidates with Laya", () => {
  it("posts one batch and scores a truncated note next to a fine one", async () => {
    const body = layaBatchReply([truncatedReply, layaCandidateReply(0.2)])
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const results = await scoreCandidates(server.context, notes)
      expect(results).toMatchObject([
        {
          succeeded: true,
          output: { probability: 0.8, diagnostics: { provider: "laya", reportedModel: "multilingual" } },
        },
        { succeeded: true, output: { probability: 0.2 } },
      ])
      expect(server.urls).toEqual(["/v1/systemone/batch"])
      const [raw] = server.requests
      if (!raw) throw new Error("No request")
      const sent = JSON.parse(raw)
      expect(Object.keys(sent)).toEqual(["model", "states", "questions", "max_len", "head_max_len"])
      expect(sent.states).toHaveLength(2)
      expect(Object.keys(sent.states[0])).toEqual(["candidate", "message"])
      expect(Object.keys(sent.questions.relevant)).toEqual(["type", "instructions", "criteria"])
      expect(sent.questions.relevant.type).toBe("noul")
      expect(raw).not.toContain("first-note")
    } finally {
      await server.close()
    }
  })

  it("fails every note on HTTP 500 without leaking the body", async () => {
    const server = await decisionServer({ body: "secret sample-token", status: 500, delayMs: 0 })
    try {
      const results = await scoreCandidates(server.context, notes)
      expect(results).toMatchObject([
        { succeeded: false, code: "http-error", httpStatus: 500 },
        { succeeded: false, code: "http-error", httpStatus: 500 },
      ])
      expect(JSON.stringify(results)).not.toContain("sample-token")
    } finally {
      await server.close()
    }
  })

  it("fails every note when the server is unreachable and sends nothing for an empty list", async () => {
    const server = await decisionServer({ body: "", status: 200, delayMs: 0 })
    expect(await scoreCandidates(server.context, [])).toEqual([])
    expect(server.requests).toHaveLength(0)
    await server.close()
    expect(await scoreCandidates(server.context, notes)).toMatchObject([
      { succeeded: false, code: "unavailable" },
      { succeeded: false, code: "unavailable" },
    ])
  })
})

describe("scoreCandidates with Jev", () => {
  it("runs every call before any of them settles and keeps one result per note", async () => {
    const context = jevContext(jevRelevantReply(0.7))
    const gate = Promise.withResolvers<JevClassifierResult>()
    vi.mocked(context.classifier.classify).mockImplementation(() => gate.promise)
    const pending = scoreCandidates(context, notes)
    await vi.waitFor(() => expect(context.classifier.classify).toHaveBeenCalledTimes(2))
    gate.resolve(jevRelevantReply(0.7))
    expect(await pending).toMatchObject([
      { succeeded: true, output: { probability: 0.7, diagnostics: { provider: "typesafe" } } },
      { succeeded: true, output: { probability: 0.7 } },
    ])
  })

  it("fails only the note whose call rejects", async () => {
    const context = jevContext(jevRelevantReply(0.7))
    vi.mocked(context.classifier.classify)
      .mockResolvedValueOnce(jevRelevantReply(0.4))
      .mockRejectedValueOnce(new Error("private-detail"))
    const results = await scoreCandidates(context, notes)
    expect(results).toMatchObject([
      { succeeded: true, output: { probability: 0.4 } },
      { succeeded: false, code: "unavailable" },
    ])
    expect(JSON.stringify(results)).not.toContain("private-detail")
  })

  it("refuses every note on invalid settings and calls nothing", async () => {
    const context = jevContext(jevRelevantReply(0.7))
    context.model = "jev preview"
    expect(await scoreCandidates(context, notes)).toMatchObject([
      { succeeded: false, code: "invalid-settings" },
      { succeeded: false, code: "invalid-settings" },
    ])
    expect(context.classifier.classify).not.toHaveBeenCalled()
  })
})

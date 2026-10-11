import { describe, expect, it, vi } from "vitest"

import { decideMemory, scoreCandidate } from "#/services"
import { candidateDecisionRequest, jevContext, jevReply, memoryDecisionRequest } from "#test-helpers"

describe("Jev pi classifier adapter", () => {
  it("uses selected typesafe classifier with a single bool question and bounded options", async () => {
    const context = jevContext({ ...jevReply(0.7), model: "jev-preview" })
    context.model = "jev-preview"
    expect(await decideMemory({ context, request: memoryDecisionRequest })).toMatchObject({
      succeeded: true,
      output: {
        probability: 0.7,
        diagnostics: {
          provider: "typesafe",
          requestedModel: "jev-preview",
          reportedModel: "jev-preview",
          usage: { inputTokens: 10, outputTokens: 0 },
        },
      },
    })
    expect(context.classifier.classify).toHaveBeenCalledWith({
      model: { provider: "typesafe", id: "jev-preview" },
      context: {
        state: memoryDecisionRequest,
        questions: {
          needed: {
            type: "bool",
            instructions: expect.stringContaining("memory"),
            criteria: { true: "Memory would help", false: "Memory would not help" },
          },
        },
      },
      options: { signal: expect.any(AbortSignal), timeoutMs: expect.any(Number), maxRetries: 0 },
    })
  })

  it("sends candidate text unchanged only after consent, without stable identity", async () => {
    const context = jevContext(jevReply(1))
    expect(await scoreCandidate({ context, request: candidateDecisionRequest })).toMatchObject({ succeeded: true })
    expect(context.classifier.classify).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          state: { message: candidateDecisionRequest.message, candidate: candidateDecisionRequest.candidate },
          questions: {
            relevant: {
              type: "bool",
              instructions: expect.any(String),
              criteria: { true: "Candidate would help", false: "Candidate would not help" },
            },
          },
        },
      }),
    )
    context.consent = "not-granted"
    vi.mocked(context.classifier.classify).mockClear()
    expect(await decideMemory({ context, request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "consent-required",
    })
    expect(context.classifier.classify).not.toHaveBeenCalled()
  })

  it.each([NaN, Infinity, -0.01, 1.01])("refuses invalid probability %s", async (probability) => {
    expect(
      await decideMemory({ context: jevContext(jevReply(probability)), request: memoryDecisionRequest }),
    ).toMatchObject({
      succeeded: false,
      code: "invalid-response",
    })
  })

  it.each([
    { ...jevReply(0.5), answer: null },
    { ...jevReply(0.5), answer: { type: "bool" } },
    { ...jevReply(0.5), answer: { type: "score", probability: 0.5 } },
    { ...jevReply(0.5), model: "other-model" },
    { ...jevReply(0.5), usage: { input: -1, output: 0 } },
  ])("refuses empty, wrong or mismatched answers", async (reply) => {
    expect(await decideMemory({ context: jevContext(reply), request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "invalid-response",
    })
  })

  it.each(["error", "aborted"] as const)("handles pi terminal %s", async (stopReason) => {
    const context = jevContext({ ...jevReply(0.9), stopReason })
    const result = await decideMemory({ context, request: memoryDecisionRequest })
    expect(result.succeeded).toBe(false)
    if (!result.succeeded) expect(["unavailable", "aborted"]).toContain(result.code)
  })

  it("suppresses thrown provider secrets, never retries", async () => {
    const context = jevContext(jevReply(0.9))
    vi.mocked(context.classifier.classify).mockRejectedValue(new Error("sample-token"))
    const result = await decideMemory({ context, request: memoryDecisionRequest })
    expect(result).toMatchObject({ succeeded: false, code: "unavailable" })
    expect(JSON.stringify(result)).not.toContain("sample-token")
    expect(context.classifier.classify).toHaveBeenCalledTimes(1)
  })
})

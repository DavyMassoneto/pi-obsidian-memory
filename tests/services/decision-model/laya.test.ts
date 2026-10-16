import { describe, expect, it } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Laya System One adapter", () => {
  it("sends native noul, explicit model and complete state; probability is not act_probability", async () => {
    const server = await decisionServer({ body: layaReply(0.75), status: 200, delayMs: 0 })
    try {
      const result = await decideMemory({ context: server.context, request: memoryDecisionRequest })
      expect(result).toMatchObject({
        succeeded: true,
        output: {
          probability: 0.75,
          diagnostics: {
            provider: "laya",
            requestedModel: "multilingual",
            reportedModel: "multilingual",
            usage: { inputTokens: 14, outputTokens: 0 },
          },
        },
      })
      const [sent] = server.requests
      expect(sent).toBeDefined()
      if (!sent) throw new Error("No request")
      const wire = JSON.parse(sent)
      expect(Object.keys(wire)).toEqual(["model", "state", "questions", "max_len", "head_max_len"])
      expect(Object.keys(wire.state)).toEqual(["project", "folder", "message"])
      expect(Object.keys(wire.questions.needed)).toEqual(["type", "instructions", "criteria", "labels"])
      expect(wire).toEqual({
        model: "multilingual",
        max_len: 8192,
        head_max_len: 192,
        state: memoryDecisionRequest,
        questions: {
          needed: {
            type: "noul",
            instructions: expect.stringContaining("memory"),
            criteria: { true: "Memory would help", false: "Memory would not help" },
            labels: { true: "A", false: "B" },
          },
        },
      })
    } finally {
      await server.close()
    }
  })

  it.each([401, 422, 429, 503, 307])("reports HTTP %s without retry, redirect or raw error", async (status) => {
    const server = await decisionServer({
      body: "secret sample-token",
      status,
      delayMs: 0,
      location: "http://example.com/secret",
    })
    try {
      const result = await decideMemory({ context: server.context, request: memoryDecisionRequest })
      expect(result).toMatchObject({ succeeded: false, code: "http-error", httpStatus: status })
      expect(server.requests).toHaveLength(1)
      expect(JSON.stringify(result)).not.toContain("sample-token")
    } finally {
      await server.close()
    }
  })

  it("surfaces the server detail of an HTTP 422, bounded, and nothing for other statuses or unparsable bodies", async () => {
    const detail = "question 'needed': no 'instructions'; add the text the model should answer"
    const cases = [
      { status: 422, body: JSON.stringify({ detail }), expected: detail },
      { status: 422, body: JSON.stringify({ detail: "x".repeat(900) }), expected: "x".repeat(500) },
      { status: 422, body: JSON.stringify({ detail: [{ loc: ["body"], msg: "bad" }] }), expected: undefined },
      { status: 422, body: "secret sample-token", expected: undefined },
      { status: 500, body: JSON.stringify({ detail }), expected: undefined },
    ]
    for (const { status, body, expected } of cases) {
      const server = await decisionServer({ body, status, delayMs: 0 })
      try {
        const result = await decideMemory({ context: server.context, request: memoryDecisionRequest })
        expect(result).toMatchObject({ succeeded: false, code: "http-error", httpStatus: status })
        expect(result).not.toHaveProperty("output")
        if (expected) expect(result).toMatchObject({ detail: expected })
        else expect(result).not.toHaveProperty("detail")
      } finally {
        await server.close()
      }
    }
  })

  it("reports externally provisioned runtime missing without fallback", async () => {
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 0 })
    await server.close()
    expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "unavailable",
    })
  })
})

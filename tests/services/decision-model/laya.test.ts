import { describe, expect, it } from "vitest"

import { decideMemory } from "#/services"
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
            reportedModel: "laya-rl-agent",
            usage: { inputTokens: 14, outputTokens: 0 },
          },
        },
      })
      const [sent] = server.requests
      expect(sent).toBeDefined()
      if (!sent) throw new Error("No request")
      expect(JSON.parse(sent)).toEqual({
        model: "multilingual",
        max_len: 8192,
        head_max_len: 192,
        state: memoryDecisionRequest,
        questions: {
          needed: {
            type: "noul",
            instructions: expect.stringContaining("memory"),
            criteria: { true: "Memory would help", false: "Memory would not help" },
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

  it("reports externally provisioned runtime missing without fallback", async () => {
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 0 })
    await server.close()
    expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "unavailable",
    })
  })
})

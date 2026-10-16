import { describe, expect, it } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, jevContext, jevReply, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Decision preflight", () => {
  it.each([
    { maxTokens: 0 },
    { maxTokens: 8193 },
    { maxTokens: 1.5 },
    { headMaxTokens: 0 },
    { headMaxTokens: 8192 },
    { headMaxTokens: Infinity },
    { model: "" },
    { deadlineMs: NaN },
  ])("refuses invalid Laya settings without transmission: %s", async (settings) => {
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 0 })
    try {
      expect(
        await decideMemory({ context: { ...server.context, ...settings }, request: memoryDecisionRequest }),
      ).toMatchObject({ succeeded: false, code: "invalid-settings" })
      expect(server.requests).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  it("does not spend inference on an expired overall deadline", async () => {
    const context = jevContext(jevReply(0.8))
    context.deadlineMs = Date.now() - 1
    expect(await decideMemory({ context, request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "deadline",
    })
    expect(context.classifier.classify).not.toHaveBeenCalled()
  })
})

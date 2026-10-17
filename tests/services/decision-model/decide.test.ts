import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, jevContext, jevReply, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("decide entry points", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reports the requested model and empty provider facts when preflight refuses", async () => {
    const context = jevContext(jevReply(0.8))
    context.model = "jev preview"
    expect(await decideMemory({ context, request: memoryDecisionRequest })).toEqual({
      succeeded: false,
      code: "invalid-settings",
      diagnostics: { provider: "typesafe", requestedModel: "jev preview", reportedModel: null, usage: null },
    })
  })

  it("routes laya contexts to the laya endpoint and labels the diagnostics with provider laya", async () => {
    vi.useRealTimers()
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 0 })
    try {
      const result = await decideMemory({ context: server.context, request: memoryDecisionRequest })
      expect(server.requests).toHaveLength(1)
      expect(result).toMatchObject({
        succeeded: true,
        output: { probability: expect.any(Number), diagnostics: { provider: "laya" } },
      })
    } finally {
      await server.close()
    }
  })
})

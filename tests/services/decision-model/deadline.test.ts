import { describe, expect, it, vi } from "vitest"

import { decideMemory } from "#/services"
import { decisionServer, jevContext, jevReply, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Decision deadline", () => {
  it("caps a far-future caller deadline at 30 seconds and signals the pi model", async () => {
    vi.useFakeTimers()
    try {
      const context = jevContext(jevReply(0.9))
      context.deadlineMs = Date.now() + 120_000
      vi.mocked(context.classifier.classify).mockImplementation(() => new Promise(() => {}))
      const pending = decideMemory({ context, request: memoryDecisionRequest })
      await vi.advanceTimersByTimeAsync(30_000)
      expect(await pending).toMatchObject({ succeeded: false, code: "deadline" })
      const request = vi.mocked(context.classifier.classify).mock.calls[0]?.[0]
      expect(request?.options.timeoutMs).toBe(30_000)
      expect(request?.options.signal.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("signals and refuses cancellation while a pi request is pending", async () => {
    const context = jevContext(jevReply(0.9))
    const controller = new AbortController()
    context.signal = controller.signal
    vi.mocked(context.classifier.classify).mockImplementation(() => new Promise(() => {}))
    const pending = decideMemory({ context, request: memoryDecisionRequest })
    controller.abort("sample-token")
    expect(await pending).toMatchObject({ succeeded: false, code: "aborted" })
    const request = vi.mocked(context.classifier.classify).mock.calls[0]?.[0]
    expect(request?.options.signal.aborted).toBe(true)
  })

  it("enforces cancellation and deadline during HTTP work", async () => {
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 1000 })
    try {
      const controller = new AbortController()
      const pending = decideMemory({
        context: { ...server.context, signal: controller.signal },
        request: memoryDecisionRequest,
      })
      controller.abort("sample-token")
      expect(await pending).toMatchObject({ succeeded: false, code: "aborted" })
      expect(
        await decideMemory({
          context: { ...server.context, deadlineMs: Date.now() + 20 },
          request: memoryDecisionRequest,
        }),
      ).toMatchObject({ succeeded: false, code: "deadline" })
    } finally {
      await server.close()
    }
  })

  it("aborts before inference and bounds an uncooperative pi port", async () => {
    const context = jevContext(jevReply(0.9))
    const controller = new AbortController()
    controller.abort()
    expect(
      await decideMemory({ context: { ...context, signal: controller.signal }, request: memoryDecisionRequest }),
    ).toMatchObject({ succeeded: false, code: "aborted" })
    expect(context.classifier.classify).not.toHaveBeenCalled()
    vi.mocked(context.classifier.classify).mockImplementation(() => new Promise(() => {}))
    expect(
      await decideMemory({ context: { ...context, deadlineMs: Date.now() + 20 }, request: memoryDecisionRequest }),
    ).toMatchObject({ succeeded: false, code: "deadline" })
  })
})

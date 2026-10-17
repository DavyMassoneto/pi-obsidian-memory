import { describe, expect, it, vi } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, jevContext, jevReply, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Decision interruption", () => {
  it("lets a classifier answer after far more than a minute without handing it a time limit", async () => {
    vi.useFakeTimers()
    try {
      const context = jevContext(jevReply(0.9))
      vi.mocked(context.classifier.classify).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(jevReply(0.9)), 300_000)),
      )
      const pending = decideMemory({ context, request: memoryDecisionRequest })
      await vi.advanceTimersByTimeAsync(300_000)
      expect(await pending).toMatchObject({ succeeded: true })
      const request = vi.mocked(context.classifier.classify).mock.calls[0]?.[0]
      expect(request?.options).toEqual({ signal: context.signal, maxRetries: 0 })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("lets a Laya server answer after far more than a minute", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 300_000 })
    try {
      const pending = decideMemory({ context: server.context, request: memoryDecisionRequest })
      await vi.waitFor(() => expect(server.requests).toHaveLength(1))
      await vi.advanceTimersByTimeAsync(300_000)
      expect(await pending).toMatchObject({ succeeded: true })
    } finally {
      vi.useRealTimers()
      await server.close()
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

  it("enforces cancellation during HTTP work", async () => {
    const server = await decisionServer({ body: layaReply(0.8), status: 200, delayMs: 1000 })
    try {
      const controller = new AbortController()
      const pending = decideMemory({
        context: { ...server.context, signal: controller.signal },
        request: memoryDecisionRequest,
      })
      controller.abort("sample-token")
      expect(await pending).toMatchObject({ succeeded: false, code: "aborted" })
    } finally {
      await server.close()
    }
  })

  it("aborts before inference", async () => {
    const context = jevContext(jevReply(0.9))
    const controller = new AbortController()
    controller.abort()
    expect(
      await decideMemory({ context: { ...context, signal: controller.signal }, request: memoryDecisionRequest }),
    ).toMatchObject({ succeeded: false, code: "aborted" })
    expect(context.classifier.classify).not.toHaveBeenCalled()
  })
})

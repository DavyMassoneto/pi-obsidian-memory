import { describe, expect, it, vi } from "vitest"

import { runEmbeddingOperation } from "#src/services"
import { embeddingOperation } from "#test-helpers"

describe("runEmbeddingOperation", () => {
  it("lets an operation run for far more than two minutes", async () => {
    vi.useFakeTimers()
    try {
      const promise = runEmbeddingOperation(
        embeddingOperation(),
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ succeeded: false, status: "unavailable" }), 3_600_000)),
      )
      await vi.advanceTimersByTimeAsync(3_600_000)
      expect(await promise).toEqual({ succeeded: false, status: "unavailable" })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not start inference when already aborted", async () => {
    let called = false
    const result = await runEmbeddingOperation({ signal: AbortSignal.abort() }, async () => {
      called = true
      return { succeeded: false, status: "unavailable" }
    })
    expect(result).toEqual({ succeeded: false, status: "aborted" })
    expect(called).toBe(false)
  })

  it("discards in-flight inference on abort and aborts the operation signal", async () => {
    const controller = new AbortController()
    let inferenceSignal: AbortSignal | null = null
    const promise = runEmbeddingOperation({ signal: controller.signal }, async (signal) => {
      inferenceSignal = signal
      return new Promise(() => {})
    })
    controller.abort()
    expect(await promise).toEqual({ succeeded: false, status: "aborted" })
    expect(inferenceSignal).toHaveProperty("aborted", true)
  })
})

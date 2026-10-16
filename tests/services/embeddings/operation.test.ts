import { describe, expect, it } from "vitest"

import { runEmbeddingOperation } from "#src/services"
import { embeddingOperation } from "#test-helpers"

describe("runEmbeddingOperation", () => {
  it("rejects invalid timeouts without starting inference", async () => {
    let called = false
    const result = await runEmbeddingOperation({ ...embeddingOperation(), timeoutMs: 0 }, async () => {
      called = true
      return { succeeded: false, status: "unavailable" }
    })
    expect(result).toEqual({ succeeded: false, status: "invalid-input" })
    expect(called).toBe(false)
  })

  it("discards in-flight inference on abort and aborts the operation signal", async () => {
    const controller = new AbortController()
    let inferenceSignal: AbortSignal | null = null
    const promise = runEmbeddingOperation({ signal: controller.signal, timeoutMs: 5000 }, async (signal) => {
      inferenceSignal = signal
      return new Promise(() => {})
    })
    controller.abort()
    expect(await promise).toEqual({ succeeded: false, status: "aborted" })
    expect(inferenceSignal).toHaveProperty("aborted", true)
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import { retrieveStep } from "#src/services"
import { completionPort, pendingCompletion, retrievalRequest } from "#test-helpers"

afterEach(() => vi.useRealTimers())

describe("completion lifetime", () => {
  it("lets a slow retrieval finish after far more than a minute", async () => {
    vi.useFakeTimers()
    const complete = completionPort("")
    complete.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: "completed", text: '{"action":"finish","notes":[]}' }), 300_000),
        ),
    )
    const pending = retrieveStep(retrievalRequest(), complete)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(await pending).toMatchObject({ succeeded: true })
    expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("returns promptly when the retrieval is aborted even if the port ignores cancellation", async () => {
    const controller = new AbortController()
    const complete = pendingCompletion()
    const pending = retrieveStep({ ...retrievalRequest(), signal: controller.signal }, complete)
    controller.abort()
    expect((await pending).succeeded).toBe(false)
    expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import { captureStep, retrieveStep } from "#src/services"
import { captureRequest, completionPort, pendingCompletion, retrievalRequest } from "#test-helpers"

afterEach(() => vi.useRealTimers())

describe("completion lifetime", () => {
  it("returns promptly on external abort even if the port ignores cancellation", async () => {
    const controller = new AbortController()
    const complete = pendingCompletion()
    const pending = captureStep({ ...captureRequest(), signal: controller.signal }, complete)
    controller.abort()
    expect((await pending).succeeded).toBe(false)
    expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(true)
  })

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

  it("lets a slow capture finish after far more than two minutes", async () => {
    vi.useFakeTimers()
    const complete = completionPort("")
    complete.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: "completed", text: '{"action":"finish"}' }), 3_600_000),
        ),
    )
    const pending = captureStep(captureRequest(), complete)
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect((await pending).succeeded).toBe(true)
    expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects a completed response if the port aborts the run before returning", async () => {
    const controller = new AbortController()
    const complete = completionPort("")
    complete.mockImplementation(async () => {
      controller.abort()
      return { status: "completed", text: '{"action":"finish"}' }
    })
    expect((await captureStep({ ...captureRequest(), signal: controller.signal }, complete)).succeeded).toBe(false)
  })
})

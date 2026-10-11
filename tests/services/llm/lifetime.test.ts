import { afterEach, describe, expect, it, vi } from "vitest"

import { captureStep, retrieveStep } from "#/services"
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

  it("caps retrieval at 30 seconds even with a later caller deadline", async () => {
    vi.useFakeTimers()
    const complete = pendingCompletion()
    const pending = retrieveStep({ ...retrievalRequest(), deadline: Date.now() + 120000 }, complete)
    await vi.advanceTimersByTimeAsync(30000)
    expect((await pending).succeeded).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { callerDuration: 120000, elapsed: 30001 },
    { callerDuration: 15, elapsed: 16 },
  ])(
    "rejects late retrieval without timer delivery: $callerDuration ms deadline",
    async ({ callerDuration, elapsed }) => {
      vi.useFakeTimers()
      const start = Date.now()
      const complete = completionPort("")
      complete.mockImplementation(async () => {
        vi.setSystemTime(start + elapsed)
        return { status: "completed", text: '{"action":"finish","notes":[]}' }
      })
      const result = await retrieveStep({ ...retrievalRequest(), deadline: start + callerDuration }, complete)
      expect(result).toEqual({ succeeded: false, problems: ["Model request aborted or expired"] })
      expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it("caps capture at 120 seconds", async () => {
    vi.useFakeTimers()
    const complete = pendingCompletion()
    const pending = captureStep({ ...captureRequest(), deadline: Date.now() + 180000 }, complete)
    await vi.advanceTimersByTimeAsync(120000)
    expect((await pending).succeeded).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("uses the caller's earlier deadline", async () => {
    vi.useFakeTimers()
    const complete = pendingCompletion()
    const pending = captureStep({ ...captureRequest(), deadline: Date.now() + 15 }, complete)
    await vi.advanceTimersByTimeAsync(15)
    expect((await pending).succeeded).toBe(false)
    expect(complete.mock.calls[0]?.[0].signal.aborted).toBe(true)
  })

  it("cleans up its timer after successful completion", async () => {
    vi.useFakeTimers()
    const complete = completionPort('{"action":"finish"}')
    expect((await captureStep(captureRequest(), complete)).succeeded).toBe(true)
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

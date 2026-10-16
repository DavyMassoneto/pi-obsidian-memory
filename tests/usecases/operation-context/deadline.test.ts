import { expect, onTestFinished, test, vi } from "vitest"

import { limitOperation } from "#src/usecases"
import { relevantFixture } from "#test-helpers"

test("the operation's signal aborts when the limit passes, and the operation is then expired", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const { context } = await relevantFixture({ laya: null })

  const limited = limitOperation(context, 1000)
  expect(limited.context.signal.aborted).toBe(false)
  expect(limited.expired()).toBe(false)
  await vi.advanceTimersByTimeAsync(1000)

  expect(limited.context.signal.aborted).toBe(true)
  expect(limited.expired()).toBe(true)
  expect(context.signal.aborted).toBe(false)
})

test("a released limit never fires", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const { context } = await relevantFixture({ laya: null })
  const limited = limitOperation(context, 1000)

  limited.release()
  await vi.advanceTimersByTimeAsync(5000)

  expect(limited.context.signal.aborted).toBe(false)
})

test("a cancelled caller stops the operation without it being expired", async () => {
  const { context, controller } = await relevantFixture({ laya: null })
  const limited = limitOperation(context, 60_000)
  onTestFinished(() => limited.release())

  controller.abort()

  expect(limited.context.signal.aborted).toBe(true)
  expect(limited.expired()).toBe(false)
})

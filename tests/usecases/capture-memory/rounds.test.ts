import { afterEach, expect, test, vi } from "vitest"

import { MAX_CAPTURE_DURATION_MS, MAX_MODEL_ROUNDS } from "#src/services"
import { captureMemory } from "#src/usecases"
import { answering, captureFixture, memoryReadTree, PNPM_ADD, scriptedCompletion, userSays } from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

test("a review stops between rounds when the operation is interrupted, as a failure, and later steps never run", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const controller = new AbortController()
  const complete = scriptedCompletion([{ action: "clarify", question: "Global or project?" }, PNPM_ADD])
  const ask = vi.fn(async () => {
    controller.abort()
    return "global"
  })

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    { ...context, signal: controller.signal },
    complete,
    ask,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted", report: { applied: [] } })
  expect(complete).toHaveBeenCalledTimes(1)
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a review that runs past the capture deadline fails as out of time and writes nothing", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const complete = scriptedCompletion([{ action: "clarify", question: "Global or project?" }, PNPM_ADD])
  const slowAnswer = vi.fn(async () => {
    vi.setSystemTime(Date.now() + MAX_CAPTURE_DURATION_MS + 1)
    return "global"
  })

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    context,
    complete,
    slowAnswer,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "out-of-time", problems: ["Capture ran out of time"] })
  expect(complete).toHaveBeenCalledTimes(1)
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a window that never finishes stops after the maximum number of rounds", async () => {
  const { context } = await captureFixture()
  const complete = scriptedCompletion(
    Array.from({ length: MAX_MODEL_ROUNDS + 3 }, () => ({
      action: "search" as const,
      vault: "global" as const,
      query: "pnpm",
      limit: 1,
    })),
  )

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    context,
    complete,
    answering(null),
  )

  expect(result).toMatchObject({ succeeded: true, output: { windows: 1, applied: [] } })
  expect(complete).toHaveBeenCalledTimes(MAX_MODEL_ROUNDS)
})

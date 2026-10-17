import { afterEach, expect, test, vi } from "vitest"

import { captureMemory } from "#src/usecases"
import { captureFixture, memoryReadTree, noteWritten, PNPM_ADD, scriptedCompletion, userSays } from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

test("a review stops between rounds when the operation is interrupted, as a failure, and later steps never run", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const controller = new AbortController()
  const complete = scriptedCompletion([
    () => {
      controller.abort()
      return { action: "search", vault: "global", query: "pnpm", limit: 1 }
    },
    PNPM_ADD,
  ])

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    { ...context, signal: controller.signal },
    complete,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted", report: { applied: [] } })
  expect(complete).toHaveBeenCalledTimes(1)
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a review whose steps take hours of wall time is not cut off, and the note is then written", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, vault } = await captureFixture()
  const complete = scriptedCompletion([
    () => {
      vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000)
      return { action: "search", vault: "global", query: "pnpm", limit: 1 }
    },
    PNPM_ADD,
  ])

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "add", status: "applied" }] } })
  expect(complete).toHaveBeenCalledTimes(3)
  expect(await noteWritten(vault.path)).toEqual(["Use pnpm.md"])
})

test("a window that keeps searching for many rounds is not cut off and ends when the model finishes", async () => {
  const { context } = await captureFixture()
  const complete = scriptedCompletion([
    ...Array.from({ length: 12 }, () => ({
      action: "search" as const,
      vault: "global" as const,
      query: "pnpm",
      limit: 1,
    })),
    { action: "finish" },
  ])

  const result = await captureMemory(
    { trigger: "after-each-turn", messages: userSays("remember pnpm"), explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { windows: 1, applied: [] } })
  expect(complete).toHaveBeenCalledTimes(13)
})

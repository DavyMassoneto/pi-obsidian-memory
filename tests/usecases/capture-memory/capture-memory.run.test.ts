import { expect, test, vi } from "vitest"

import { captureMemory } from "#src/usecases"
import {
  captureFixture,
  completionPort,
  expectRegistrationLeaseReleased,
  memoryReadTree,
  userSays,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a failed model call ends the run at once, names the provider's error, and nothing is written", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const complete = vi.fn(async () => ({ status: "error" as const, error: "provider down" }))

  const result = await captureMemory({ messages: userSays("remember pnpm"), explicitSaves: [] }, context, complete)

  expect(result).toMatchObject({
    succeeded: false,
    reason: "model-failed",
    problems: [expect.stringContaining("provider down")],
  })
  expect(complete).toHaveBeenCalledTimes(1)
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a model call that fails because the signal aborted is an interruption, not a model failure", async () => {
  const { context } = await captureFixture()
  const controller = new AbortController()
  const complete = vi.fn(async () => {
    controller.abort()
    return { status: "aborted" as const }
  })

  const result = await captureMemory(
    { messages: userSays("remember pnpm"), explicitSaves: [] },
    { ...context, signal: controller.signal },
    complete,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted" })
  expect(complete).toHaveBeenCalledTimes(1)
})

test("a run with no config is refused", async () => {
  const { context } = await captureFixture()
  await writeRegistrationSnapshot(context, "")

  const result = await captureMemory({ messages: userSays("x"), explicitSaves: [] }, context, completionPort("{}"))

  expect(result.succeeded).toBe(false)
  await expectRegistrationLeaseReleased(context)
})

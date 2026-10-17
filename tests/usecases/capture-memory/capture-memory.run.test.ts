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

test("a long transcript is reviewed in windows of at most a hundred items", async () => {
  const { context } = await captureFixture()
  const messages = Array.from({ length: 101 }, (_, number) => ({ role: "user" as const, text: `message ${number}` }))
  const complete = completionPort(JSON.stringify({ action: "finish" }))

  const result = await captureMemory({ messages, trigger: "after-each-turn", explicitSaves: [] }, context, complete)

  expect(result).toMatchObject({ succeeded: true, output: { windows: 2 } })
  expect(complete).toHaveBeenCalledTimes(2)
})

test("a failed model call ends the run at once, names the provider's error, and nothing is written", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const complete = vi.fn(async () => ({ status: "error" as const, error: "provider down" }))

  const result = await captureMemory(
    { messages: userSays("remember pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
  )

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
    { messages: userSays("remember pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    { ...context, signal: controller.signal },
    complete,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted" })
  expect(complete).toHaveBeenCalledTimes(1)
})

test("a run with no config is refused", async () => {
  const { context } = await captureFixture()
  await writeRegistrationSnapshot(context, "")

  const result = await captureMemory(
    { messages: userSays("x"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    completionPort("{}"),
  )

  expect(result.succeeded).toBe(false)
  await expectRegistrationLeaseReleased(context)
})

test("a trigger that is not the configured one reviews nothing and never calls the model", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const complete = completionPort(JSON.stringify({ action: "finish" }))

  for (const trigger of ["on-compaction", "at-session-end"] as const) {
    const result = await captureMemory(
      { trigger, messages: userSays("remember pnpm"), explicitSaves: [] },
      context,
      complete,
    )
    expect(result).toEqual({ succeeded: true, output: { windows: 0, applied: [] } })
  }

  expect(complete).not.toHaveBeenCalled()
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

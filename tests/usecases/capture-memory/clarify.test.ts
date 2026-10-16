import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { captureMemory } from "#src/usecases"
import {
  answering,
  captureFixture,
  completionPort,
  expectRegistrationLeaseReleased,
  memoryReadTree,
  scriptedCompletion,
  userSays,
  writeRegistrationSnapshot,
} from "#test-helpers"

const noteDraft = {
  folder: "preferences",
  statement: "Use pnpm",
  body: "The user always uses pnpm, never npm.",
  type: "rule",
  dontForget: false,
} as const

test("a question the user cannot answer writes nothing and ends that review", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const ask = answering(null)
  const complete = scriptedCompletion([
    { action: "clarify", question: "Is this about you or about this project?" },
    { action: "add", vault: "global", note: noteDraft },
  ])

  const result = await captureMemory(
    { messages: userSays("remember pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
    ask,
  )

  expect(ask).toHaveBeenCalledWith(
    "Is this about you or about this project?",
    expect.objectContaining({ timeoutMs: expect.any(Number) }),
  )
  expect(complete).toHaveBeenCalledTimes(1)
  expect(result).toMatchObject({
    succeeded: true,
    output: { applied: [], skipped: ["Is this about you or about this project?"] },
  })
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("an answered question is given back to the model and the note is saved", async () => {
  const { context, vault } = await captureFixture()
  const complete = scriptedCompletion([
    { action: "clarify", question: "Global or project?" },
    (input) => {
      const answer = input.observations.findLast((item) => item.kind === "clarification")
      if (answer?.kind !== "clarification" || answer.answer !== "global") throw new Error("answer was not passed on")
      return { action: "add", vault: "global", note: noteDraft }
    },
    { action: "finish" },
  ])

  const result = await captureMemory(
    { messages: userSays("remember pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
    answering("global"),
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "add", status: "applied" }] } })
  expect(await readdir(join(vault.path, "preferences"))).toContain("Use pnpm.md")
})

test("a long transcript is reviewed in windows of at most a hundred items", async () => {
  const { context } = await captureFixture()
  const messages = Array.from({ length: 101 }, (_, number) => ({ role: "user" as const, text: `message ${number}` }))
  const complete = completionPort(JSON.stringify({ action: "finish" }))

  const result = await captureMemory(
    { messages, trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
    answering(null),
  )

  expect(result).toMatchObject({ succeeded: true, output: { windows: 2 } })
  expect(complete).toHaveBeenCalledTimes(2)
})

test("a model that returns nothing usable fails the run and nothing is written", async () => {
  const { context, vault } = await captureFixture()
  const before = await memoryReadTree(vault.path)
  const complete = vi.fn(async () => ({ status: "error" as const }))

  const result = await captureMemory(
    { messages: userSays("remember pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
    answering(null),
  )

  expect(result).toMatchObject({ succeeded: false, reason: "model-failed" })
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a run with no config is refused", async () => {
  const { context } = await captureFixture()
  await writeRegistrationSnapshot(context, "")

  const result = await captureMemory(
    { messages: userSays("x"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    completionPort("{}"),
    answering(null),
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
      answering(null),
    )
    expect(result).toEqual({ succeeded: true, output: { windows: 0, applied: [], skipped: [] } })
  }

  expect(complete).not.toHaveBeenCalled()
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

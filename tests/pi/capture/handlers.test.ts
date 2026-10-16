import { expect, test } from "vitest"

import {
  ADD_PNPM,
  assistantEntry,
  capturePiFixture,
  eventually,
  fakePiContext,
  noteWritten,
  PNPM_ADD,
  type StepFunction,
  userEntry,
} from "#test-helpers"

const branch = [userEntry("1", "I always use pnpm"), assistantEntry("2", [{ type: "text", text: "Noted." }])]

test("after-each-turn reviews the transcript when the agent ends, with the configured model, and saves the cursor", async () => {
  const { pi, complete, globalVault, workingFolder } = await capturePiFixture("after-each-turn", ADD_PNPM)
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(async () => expect(await noteWritten(globalVault)).toEqual(["Use pnpm.md"]))
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "2" }]))
  expect(complete.mock.calls[0]?.[0].model).toEqual({ provider: "test-chat", id: "selected-chat" })
})

test("the other triggers do nothing for after-each-turn: compaction and shutdown never call the model", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", ADD_PNPM)
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.compact(context)
  await pi.shutdownSession(context)

  expect(complete).not.toHaveBeenCalled()
  expect(pi.cursors).toEqual([])
})

test("on-compaction reviews at the compaction event, and does not hold compaction back", async () => {
  const gate = Promise.withResolvers<void>()
  const slowAdd: StepFunction = async () => {
    await gate.promise
    return PNPM_ADD
  }
  const { pi, complete, globalVault, workingFolder } = await capturePiFixture("on-compaction", [
    slowAdd,
    { action: "finish" },
  ])
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)
  await pi.compact(context)
  expect(await noteWritten(globalVault)).toEqual([])
  gate.resolve()

  await eventually(async () => expect(await noteWritten(globalVault)).toEqual(["Use pnpm.md"]))
  await eventually(() => expect(complete).toHaveBeenCalledTimes(2))
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "2" }]))
})

test("at-session-end reviews when the session shuts down, and shutdown waits for it", async () => {
  const { pi, complete, globalVault, workingFolder } = await capturePiFixture("at-session-end", ADD_PNPM)
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)
  await pi.compact(context)
  expect(complete).not.toHaveBeenCalled()
  await pi.shutdownSession(context)

  expect(await noteWritten(globalVault)).toEqual(["Use pnpm.md"])
  expect(pi.cursors).toEqual([{ lastEntryId: "2" }])
})

test("capture adds nothing to the main prompt and returns no message", async () => {
  const { pi, workingFolder, globalVault } = await capturePiFixture("after-each-turn", ADD_PNPM)
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")
  const before = await pi.runPrompt(workingFolder)

  await pi.endAgent(context)
  await eventually(async () => expect(await noteWritten(globalVault)).toEqual(["Use pnpm.md"]))
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "2" }]))

  expect(await pi.runPrompt(workingFolder)).toEqual(before)
})

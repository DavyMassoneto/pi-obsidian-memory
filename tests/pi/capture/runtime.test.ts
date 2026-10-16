import { expect, test } from "vitest"

import { MAX_CAPTURE_DURATION_MS } from "#src/services"
import {
  ADD_PNPM,
  assistantEntry,
  capturePiFixture,
  cursorEntry,
  eventually,
  fakePiContext,
  noteWithId,
  noteWritten,
  putCatalogFile,
  type StepFunction,
  toolResultEntry,
  userEntry,
} from "#test-helpers"

const branch = [userEntry("1", "I always use pnpm"), assistantEntry("2", [{ type: "text", text: "Noted." }])]

test("a request made while a review runs schedules exactly one more review, never overlapping", async () => {
  const gate = Promise.withResolvers<void>()
  const slow: StepFunction = async () => {
    await gate.promise
    return { action: "finish" }
  }
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [slow])
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)
  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  await pi.endAgent(context)
  await pi.endAgent(context)
  await pi.endAgent(context)
  expect(complete).toHaveBeenCalledTimes(1)
  gate.resolve()

  await eventually(() => expect(complete).toHaveBeenCalledTimes(2))
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(complete).toHaveBeenCalledTimes(2)
})

test("with a UI a question is asked and the answer reaches the model, then the note is saved", async () => {
  const { pi, globalVault, workingFolder } = await capturePiFixture("after-each-turn", [
    { action: "clarify", question: "Global or project?" },
    ...ADD_PNPM,
  ])
  const { context, prompts, notifications } = fakePiContext(workingFolder, {
    hasUI: true,
    branch,
    answers: { inputs: ["global"] },
  })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(async () => expect(await noteWritten(globalVault)).toEqual(["Use pnpm.md"]))
  expect(prompts).toMatchObject([{ kind: "input", title: "Global or project?" }])
  await eventually(() =>
    expect(notifications).toContainEqual({ message: "Memory capture applied 1 change(s).", type: "info" }),
  )
})

test("without a UI a question means skip: nothing is written and the skipped item is not reviewed again", async () => {
  const { pi, complete, globalVault, workingFolder } = await capturePiFixture("after-each-turn", [
    { action: "clarify", question: "Global or project?" },
    ...ADD_PNPM,
  ])
  const { context, prompts } = fakePiContext(workingFolder, { hasUI: false, branch })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(prompts).toEqual([])
  expect(await noteWritten(globalVault)).toEqual([])
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "2" }]))
})

test("a model failure is shown as a warning with a UI and stays silent without one", async () => {
  const failing: StepFunction = () => {
    throw new Error("boom")
  }
  const withUi = await capturePiFixture(
    "after-each-turn",
    Array.from({ length: 10 }, () => failing),
  )
  const ui = fakePiContext(withUi.workingFolder, { hasUI: true, branch })
  await withUi.pi.startSession(ui.context, "startup")
  const withoutUi = await capturePiFixture(
    "after-each-turn",
    Array.from({ length: 10 }, () => failing),
  )
  const quiet = fakePiContext(withoutUi.workingFolder, { hasUI: false, branch })
  await withoutUi.pi.startSession(quiet.context, "startup")

  await withUi.pi.endAgent(ui.context)
  await withoutUi.pi.endAgent(quiet.context)

  await eventually(() =>
    expect(ui.notifications).toEqual([
      { message: expect.stringContaining("Memory capture did not finish:"), type: "warning" },
    ]),
  )
  await eventually(() => expect(withoutUi.complete).toHaveBeenCalledTimes(8))
  expect(quiet.notifications).toEqual([])
  expect(withUi.pi.cursors).toEqual([])
})

test("notes saved with memory_add in the reviewed turns are given to the model as explicit saves", async () => {
  const seen: string[] = []
  const inspect: StepFunction = (input) => {
    seen.push(...input.explicitSaves.map((save) => save.path))
    return { action: "finish" }
  }
  const { pi, complete, vaults, workingFolder } = await capturePiFixture("after-each-turn", [inspect])
  await putCatalogFile(vaults.global, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const entries = [...branch, toolResultEntry("3", "memory_add", { vault: "global", path: "tools/Use pnpm.md" })]
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch: entries })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(seen).toEqual(["tools/Use pnpm.md"])
})

test("after a resume only the messages after the saved cursor are reviewed", async () => {
  let delta: string[] = []
  const inspect: StepFunction = (input) => {
    delta = input.transcriptDelta.map((message) => message.text)
    return { action: "finish" }
  }
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [inspect])
  const entries = [...branch, cursorEntry("3", "2"), userEntry("4", "a brand new message")]
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch: entries })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(delta).toEqual(["a brand new message"])
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "4" }]))
})

test("a session with nothing new to review never calls the model", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", ADD_PNPM)
  const { context } = fakePiContext(workingFolder, { hasUI: false, branch: [...branch, cursorEntry("3", "2")] })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)
  await new Promise((resolve) => setTimeout(resolve, 100))

  expect(complete).not.toHaveBeenCalled()
})

test("a question is asked with the time left until the capture deadline and a signal that stops it", async () => {
  const { pi, workingFolder } = await capturePiFixture("after-each-turn", [
    { action: "clarify", question: "Global or project?" },
    { action: "finish" },
  ])
  const { context, prompts } = fakePiContext(workingFolder, { hasUI: true, branch, answers: { inputs: ["global"] } })
  await pi.startSession(context, "startup")

  await pi.endAgent(context)

  await eventually(() => expect(prompts).toHaveLength(1))
  const dialog = prompts[0]?.dialog
  expect(dialog?.timeout).toBeGreaterThan(0)
  expect(dialog?.timeout).toBeLessThanOrEqual(MAX_CAPTURE_DURATION_MS)
  expect(dialog?.signal).toBeInstanceOf(AbortSignal)
})

test("a question nobody answers ends when the session is replaced: no cursor, no warning, and the next review runs", async () => {
  const { pi, complete, workingFolder } = await capturePiFixture("after-each-turn", [
    { action: "clarify", question: "Global or project?" },
    { action: "finish" },
  ])
  const first = fakePiContext(workingFolder, { hasUI: true, hangingInputs: true, branch })
  await pi.startSession(first.context, "startup")
  await pi.endAgent(first.context)
  await eventually(() => expect(first.prompts).toHaveLength(1))
  const second = fakePiContext(workingFolder, { hasUI: false, branch })

  await pi.startSession(second.context, "new")
  await pi.endAgent(second.context)

  await eventually(() => expect(complete).toHaveBeenCalledTimes(2))
  await eventually(() => expect(pi.cursors).toEqual([{ lastEntryId: "2" }]))
  expect(first.notifications).toEqual([])
})

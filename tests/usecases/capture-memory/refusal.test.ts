import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { captureMemory } from "#src/usecases"
import {
  answering,
  captureFixture,
  noteWithId,
  PNPM_ADD,
  putCatalogFile,
  reviewRun,
  scriptedCompletion,
} from "#test-helpers"

test("a step the model got wrong is sent back as a refusal and the review goes on to a valid step", async () => {
  const { context, vault } = await captureFixture()
  const told: string[] = []
  const complete = scriptedCompletion([
    {
      action: "add",
      vault: "global",
      note: { folder: "", statement: "Use pnpm", body: "The user always uses pnpm.", type: "rule", dontForget: false },
    },
    (input) => {
      const refused = input.observations.findLast((item) => item.kind === "refused")
      if (refused?.kind === "refused") told.push(...refused.problems)
      return PNPM_ADD
    },
    { action: "finish" },
  ])

  const result = await captureMemory(reviewRun("remember pnpm"), context, complete, answering(null))

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "add", status: "applied" }] } })
  expect(told).toEqual([expect.stringContaining("subject folder")])
  expect(await readFile(join(vault.path, "preferences/Use pnpm.md"), "utf8")).toContain("pnpm")
})

test("text that is not an action is refused as unparseable and the model can try again", async () => {
  const { context } = await captureFixture()
  const complete = vi
    .fn()
    .mockResolvedValueOnce({ status: "completed", text: "this is not json" })
    .mockResolvedValue({ status: "completed", text: JSON.stringify({ action: "finish" }) })

  const result = await captureMemory(reviewRun("remember pnpm"), context, complete, answering(null))

  expect(result).toMatchObject({ succeeded: true, output: { applied: [] } })
  expect(complete).toHaveBeenCalledTimes(2)
})

test("a model that keeps returning invalid steps is asked again until it finishes", async () => {
  const { context } = await captureFixture()
  const complete = vi.fn(async () => {
    if (complete.mock.calls.length > 12) return { status: "completed" as const, text: '{"action":"finish"}' }
    return { status: "completed" as const, text: "not json at all" }
  })

  const result = await captureMemory(reviewRun("remember pnpm"), context, complete, answering(null))

  expect(result).toMatchObject({ succeeded: true, output: { applied: [] } })
  expect(complete).toHaveBeenCalledTimes(13)
})

test("a question is asked with only the operation's signal and no time limit", async () => {
  const { context } = await captureFixture()
  const ask = answering("global")
  const complete = scriptedCompletion([{ action: "clarify", question: "Global or project?" }, { action: "finish" }])

  await captureMemory(reviewRun("remember pnpm"), context, complete, ask)

  const call = ask.mock.calls[0]
  if (!call) throw new Error("the question was not asked")
  const [question, limits] = call
  expect(question).toBe("Global or project?")
  expect(limits).toEqual({ signal: context.signal })
})

test("an Obsidian edit followed by the main model's own read does not let capture overwrite the edit", async () => {
  const { context, vault, read } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const capture = { ...context, session: context.session.sibling({ sessionId: "s", branchId: "capture" }) }
  const sibling = {
    ...capture,
    stamp: capture.session.stamp(),
    signal: capture.session.signal(capture.session.stamp()),
  }
  const complete = scriptedCompletion([
    { action: "get", vault: "global", path: "tools/Use pnpm.md" },
    async (input) => {
      const known = input.observations.findLast((item) => item.kind === "read")
      if (known?.kind !== "read") throw new Error("no read observation")
      await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "The user edited this.", []))
      await read("global", "tools/Use pnpm.md")
      return {
        action: "update",
        vault: "global",
        path: known.path,
        id: known.id,
        expectedHash: known.hash,
        note: { folder: "tools", statement: "Use pnpm", body: "Capture's version.", type: "rule", dontForget: false },
      }
    },
    { action: "finish" },
  ])

  const result = await captureMemory(reviewRun("remember pnpm"), sibling, complete, answering(null))

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "update", status: "conflict" }] } })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toBe(noteWithId(1, "The user edited this.", []))
})

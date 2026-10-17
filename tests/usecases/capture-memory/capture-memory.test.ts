import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { captureMemory } from "#src/usecases"
import {
  captureFixture,
  expectRegistrationLeaseReleased,
  memoryReadTree,
  noteWithId,
  putCatalogFile,
  scriptedCompletion,
  userSays,
} from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

const noteDraft = {
  folder: "preferences",
  statement: "Use pnpm",
  body: "The user always uses pnpm, never npm.",
  type: "rule",
  dontForget: false,
} as const

const existingDraft = {
  folder: "tools",
  statement: "Use pnpm",
  body: "Always pnpm, in CI too.",
  type: "rule",
  dontForget: false,
} as const

test("a stated preference becomes a global note on disk", async () => {
  const { context, vault } = await captureFixture()
  const complete = scriptedCompletion([
    { action: "search", vault: "global", query: "pnpm", limit: 5 },
    { action: "add", vault: "global", note: noteDraft },
    { action: "finish" },
  ])

  const result = await captureMemory(
    { messages: userSays("I always use pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      windows: 1,
      applied: [{ operation: "add", status: "applied", vault: "global", path: "preferences/Use pnpm.md" }],
    },
  })
  expect(await readFile(join(vault.path, "preferences/Use pnpm.md"), "utf8")).toContain("never npm")
  expect(complete).toHaveBeenCalledTimes(3)
  await expectRegistrationLeaseReleased(context)
})

test("an update keeps the note's id and sets updated to today", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const complete = scriptedCompletion([
    { action: "get", vault: "global", path: "tools/Use pnpm.md" },
    (input) => {
      const read = input.observations.findLast((item) => item.kind === "read")
      if (read?.kind !== "read") throw new Error("no read observation")
      return {
        action: "update",
        vault: "global",
        path: read.path,
        id: read.id,
        expectedHash: read.hash,
        note: existingDraft,
      }
    },
    { action: "finish" },
  ])

  const result = await captureMemory(
    { messages: userSays("pnpm in CI too"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "update", status: "applied" }] } })
  const text = await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")
  expect(text).toContain("id: 01JABCDE7XKQ2M9V3RTN8WPZ01")
  expect(text).toContain("updated: 2026-10-20")
  expect(text).toContain("in CI too")
})

test("a succession archives the old note and links both ways", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const complete = scriptedCompletion([
    { action: "get", vault: "global", path: "tools/Use pnpm.md" },
    (input) => {
      const read = input.observations.findLast((item) => item.kind === "read")
      if (read?.kind !== "read") throw new Error("no read observation")
      return {
        action: "succeed",
        vault: "global",
        path: read.path,
        id: read.id,
        expectedHash: read.hash,
        note: {
          folder: "tools",
          statement: "Use bun",
          body: "Bun replaced pnpm.",
          type: "decision",
          dontForget: false,
        },
      }
    },
    { action: "finish" },
  ])

  const result = await captureMemory(
    { messages: userSays("we moved to bun"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "succeed", status: "applied" }] } })
  expect(await readFile(join(vault.path, "archive/tools/Use pnpm.md"), "utf8")).toContain(
    'replacedBy: "[[tools/Use bun]]"',
  )
  expect(await readFile(join(vault.path, "tools/Use bun.md"), "utf8")).toContain(
    'replaces: "[[archive/tools/Use pnpm]]"',
  )
})

test("an add that repeats an explicit save is refused, the model is told why and nothing is written", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "preferences/Use pnpm.md", noteWithId(1, noteDraft.body, []))
  const before = await memoryReadTree(vault.path)
  const told: string[] = []
  const complete = scriptedCompletion([
    { action: "add", vault: "global", note: noteDraft },
    (input) => {
      const refused = input.observations.findLast((item) => item.kind === "refused")
      if (refused?.kind === "refused") told.push(...refused.problems)
      return { action: "finish" }
    },
  ])

  const result = await captureMemory(
    {
      trigger: "after-each-turn",
      messages: userSays("remember pnpm"),
      explicitSaves: [{ vault: "global", path: "preferences/Use pnpm.md" }],
    },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [] } })
  expect(told).toEqual([expect.stringContaining("not a duplicate add")])
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("a note edited in Obsidian while capture runs is a conflict and the user's bytes stay", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const complete = scriptedCompletion([
    { action: "get", vault: "global", path: "tools/Use pnpm.md" },
    async (input) => {
      const read = input.observations.findLast((item) => item.kind === "read")
      if (read?.kind !== "read") throw new Error("no read observation")
      await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "The user edited this.", []))
      return {
        action: "update",
        vault: "global",
        path: read.path,
        id: read.id,
        expectedHash: read.hash,
        note: existingDraft,
      }
    },
    { action: "finish" },
  ])

  const result = await captureMemory(
    { messages: userSays("pnpm"), trigger: "after-each-turn", explicitSaves: [] },
    context,
    complete,
  )

  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "update", status: "conflict" }] } })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toBe(noteWithId(1, "The user edited this.", []))
})

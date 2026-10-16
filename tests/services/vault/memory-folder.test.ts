import { mkdir, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, succeedStoredNote } from "#/services"
import { aDecision, aLimits, aNote, linkFolder, useTempFolder, vaultWithQuestion } from "#test-helpers"

const limits = aLimits()
const today = "2026-10-06"
const decision = aDecision()

test.each(["archive", "_templates", ".hidden", "archive/pnpm"])(
  "refuses to create a note in %s, creating nothing",
  async (folder) => {
    const vault = await useTempFolder()

    expect(await createMemoryNote({ path: vault, limits }, folder, aNote())).toMatchObject({
      succeeded: false,
      reason: "invalid",
    })
    expect(await readdir(vault)).toEqual([])
  },
)

test("accepts a note in a nested folder whose name only resembles a reserved one", async () => {
  const vault = await useTempFolder()
  const note = aNote()

  expect(await createMemoryNote({ path: vault, limits }, "archive-notes/_templates-2", note)).toMatchObject({
    succeeded: true,
  })
  expect(await readFile(join(vault, "archive-notes", "_templates-2", `${note.statement}.md`), "utf8")).toBe(
    renderNote(note),
  )
})

test.each(["archive", "_templates", ".hidden"])("refuses a memory alias into %s", async (destination) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, destination))
  await linkFolder(join(vault, destination), join(vault, "alias"))

  expect(await createMemoryNote({ path: vault, limits }, "alias/new", aNote())).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readdir(join(vault, destination))).toEqual([])
})

test("refuses a successor in a folder reserved for the vault, changing nothing", async () => {
  const { vault, request } = await vaultWithQuestion(today)
  const reserved = { ...request, successor: { folder: "archive/search", note: decision } }

  expect(await succeedStoredNote({ path: vault, name: "Global memory", limits }, reserved)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder "archive": is reserved for the vault'],
  })
  expect(await readdir(vault)).toEqual(["search"])
})

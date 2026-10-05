import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createNote, readNote } from "#/services"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("writes the note in its subject folder, creating the missing folders", async () => {
  const vault = await useTempVault()
  const note = aNote()

  await createNote(vault, "tools/pnpm", note, limits)

  expect(await readFile(join(vault, "tools/pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

test("returns the hash of what it wrote, the same a later read sees", async () => {
  const vault = await useTempVault()
  const note = aNote()

  const created = await createNote(vault, "pnpm", note, limits)
  const read = await readNote(vault, "pnpm", note.statement)

  expect(created).toEqual(read)
})

test("refuses an invalid note and writes nothing", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), body: "" }

  expect(await createNote(vault, "pnpm", note, limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readdir(vault)).toEqual([])
})

test.each([
  ["the same name", "Use pnpm, never npm"],
  ["the same name in another case", "USE PNPM, NEVER NPM"],
])("refuses when a note with %s already exists, leaving it untouched", async (_case, existing) => {
  const vault = await useTempVault()
  await mkdir(join(vault, "pnpm"))
  await writeFile(join(vault, "pnpm", `${existing}.md`), "user content")

  expect(await createNote(vault, "pnpm", aNote(), limits)).toEqual({
    succeeded: false,
    reason: "exists",
    problems: [`pnpm/${existing}.md already exists`],
  })
  expect(await readFile(join(vault, "pnpm", `${existing}.md`), "utf8")).toBe("user content")
})

test("leaves no temporary file behind", async () => {
  const vault = await useTempVault()
  const note = aNote()

  await createNote(vault, "pnpm", note, limits)

  expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
})

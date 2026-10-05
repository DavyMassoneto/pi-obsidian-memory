import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { archiveStoredNote, createNote, readNote } from "#/services"
import { aNote, linkFolder, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }
const today = "2026-10-06"

async function vaultWithNote() {
  const vault = await useTempVault()
  const note = aNote()
  const created = await createNote(vault, "pnpm", note, limits)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }
  const request = { note: { folder: "pnpm", note }, hashWhenRead: created.output.hash, today }
  return { vault, note, request, file: join(vault, "pnpm", `${note.statement}.md`) }
}

test("moves the note to archive/ under the same subject, with the archived date", async () => {
  const { vault, note, request } = await vaultWithNote()

  const archived = await archiveStoredNote(vault, "Global memory", request, limits)

  const expectedNote = { ...note, frontmatter: { ...note.frontmatter, archived: today } }
  expect(archived).toEqual({ succeeded: true, output: { folder: "archive/pnpm", note: expectedNote } })
  expect(await readNote(vault, "archive/pnpm", note.statement)).toMatchObject({ output: { note: expectedNote } })
  expect(await readNote(vault, "pnpm", note.statement)).toMatchObject({ reason: "not-found" })
})

test("refreshes the indexes on both sides", async () => {
  const { vault, note, request } = await vaultWithNote()

  await archiveStoredNote(vault, "Global memory", request, limits)

  expect(await readFile(join(vault, "pnpm", "index.md"), "utf8")).not.toContain(note.statement)
  expect(await readFile(join(vault, "archive", "pnpm", "index.md"), "utf8")).toContain(note.statement)
  expect(await readFile(join(vault, "index.md"), "utf8")).toContain("## Archive")
})

test("refuses with a conflict when the note changed since it was read, changing nothing", async () => {
  const { vault, note, request, file } = await vaultWithNote()
  const edited = renderNote({ ...note, body: "Edited in Obsidian." })
  await writeFile(file, edited)

  expect(await archiveStoredNote(vault, "Global memory", request, limits)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readFile(file, "utf8")).toBe(edited)
  expect(await readdir(vault)).toEqual(["pnpm"])
})

test("refuses when the archive already has a note with that name, changing nothing", async () => {
  const { vault, note, request, file } = await vaultWithNote()
  await createNote(vault, "archive/pnpm", note, limits)
  const before = await readFile(file, "utf8")

  expect(await archiveStoredNote(vault, "Global memory", request, limits)).toEqual({
    succeeded: false,
    reason: "exists",
    problems: [`archive/pnpm/${note.statement}.md already exists`],
  })
  expect(await readFile(file, "utf8")).toBe(before)
})

test("leaves no temporary file behind", async () => {
  const { vault, request } = await vaultWithNote()

  await archiveStoredNote(vault, "Global memory", request, limits)

  expect(await readdir(join(vault, "pnpm"))).toEqual(["index.md"])
  expect((await readdir(join(vault, "archive", "pnpm"))).sort()).toEqual([`${aNote().statement}.md`, "index.md"].sort())
})

test("refuses to archive a note reached through a link that leads outside the vault, changing nothing", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const note = aNote()
  const created = await createNote(outside, "pnpm", note, limits)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }
  await linkFolder(join(outside, "pnpm"), join(vault, "pnpm"))
  const request = { note: { folder: "pnpm", note }, hashWhenRead: created.output.hash, today }

  expect(await archiveStoredNote(vault, "Global memory", request, limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["pnpm leads outside the vault"],
  })
  expect(await readdir(vault)).toEqual(["pnpm"])
  expect(await readdir(join(outside, "pnpm"))).toEqual([`${note.statement}.md`])
  expect(await readFile(join(outside, "pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

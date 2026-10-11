import { lstat, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { archiveStoredNote, createMemoryNote, readNote, refreshIndexes } from "#/services"
import {
  aLimits,
  aNote,
  linkFolder,
  putNoteFile,
  tryLinkFile,
  useTempFolder,
  vaultWithNoteToArchive,
} from "#test-helpers"

const limits = aLimits()
const today = "2026-10-06"

test("archives the resolved file target while retaining its alias entry", async (context) => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  const alias = join(vault, "pnpm", "Alias.md")
  if (!(await tryLinkFile(file, alias))) {
    context.skip("this system cannot create file links")
    return
  }
  const aliased = { ...request, note: { folder: "pnpm", note: { ...note, statement: "Alias" } } }

  expect(await archiveStoredNote({ path: vault, name: "Memory", limits }, aliased)).toMatchObject({ succeeded: true })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readNote({ path: vault, limits }, "archive/pnpm", "Alias")).toMatchObject({
    succeeded: true,
    output: { note: { body: note.body, frontmatter: { id: note.frontmatter.id, archived: today } } },
  })
})

test("refreshes the physical target folder after archiving a cross-folder alias", async (context) => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  const alias = join(vault, "Alias.md")
  if (!(await tryLinkFile(file, alias))) {
    context.skip("this system cannot create file links")
    return
  }
  await refreshIndexes({ path: vault, name: "Memory", limits }, "pnpm")
  const aliased = { ...request, note: { folder: "", note: { ...note, statement: "Alias" } } }

  expect(await archiveStoredNote({ path: vault, name: "Memory", limits }, aliased)).toMatchObject({ succeeded: true })
  expect(await readFile(join(vault, "pnpm", "index.md"), "utf8")).not.toContain(note.statement)
  expect(await readFile(join(vault, "archive", "index.md"), "utf8")).toContain("[[archive/Alias|Alias]]")
  expect(await readFile(join(vault, "index.md"), "utf8")).toContain("Needs fixing")
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
})

test("moves the note to archive/ under the same subject, with the archived date", async () => {
  const { vault, note, request } = await vaultWithNoteToArchive(today)

  const archived = await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)

  const expectedNote = { ...note, frontmatter: { ...note.frontmatter, archived: today } }
  expect(archived).toEqual({ succeeded: true, output: { folder: "archive/pnpm", note: expectedNote } })
  expect(await readNote({ path: vault, limits }, "archive/pnpm", note.statement)).toMatchObject({
    output: { note: expectedNote },
  })
  expect(await readNote({ path: vault, limits }, "pnpm", note.statement)).toMatchObject({ reason: "not-found" })
})

test("refreshes the indexes on both sides", async () => {
  const { vault, note, request } = await vaultWithNoteToArchive(today)

  await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)

  expect(await readFile(join(vault, "pnpm", "index.md"), "utf8")).not.toContain(note.statement)
  expect(await readFile(join(vault, "archive", "pnpm", "index.md"), "utf8")).toContain(note.statement)
  expect(await readFile(join(vault, "index.md"), "utf8")).toContain("## Archive")
})

test("refuses with a conflict when the note changed since it was read, changing nothing", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  const edited = renderNote({ ...note, body: "Edited in Obsidian." })
  await writeFile(file, edited)

  expect(await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readFile(file, "utf8")).toBe(edited)
  expect(await readdir(vault)).toEqual(["pnpm"])
})

test("refuses when the archive already has a note with that name, changing nothing", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  await putNoteFile(vault, "archive/pnpm", note.statement, renderNote(note))
  const before = await readFile(file, "utf8")

  expect(await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: note.statement,
    problems: [`archive/pnpm/${note.statement}.md already exists`],
  })
  expect(await readFile(file, "utf8")).toBe(before)
})

test("leaves no temporary file behind", async () => {
  const { vault, request } = await vaultWithNoteToArchive(today)

  await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)

  expect(await readdir(join(vault, "pnpm"))).toEqual(["index.md"])
  expect((await readdir(join(vault, "archive", "pnpm"))).sort()).toEqual([`${aNote().statement}.md`, "index.md"].sort())
})

test("refuses to archive a note reached through a link that leads outside the vault, changing nothing", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  const note = aNote()
  const created = await createMemoryNote({ path: outside, limits }, "pnpm", note)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }
  await linkFolder(join(outside, "pnpm"), join(vault, "pnpm"))
  const request = { note: { folder: "pnpm", note }, hashWhenRead: created.output.hash, today }

  expect(await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["pnpm leads outside the vault"],
  })
  expect(await readdir(vault)).toEqual(["pnpm"])
  expect(await readdir(join(outside, "pnpm"))).toEqual([`${note.statement}.md`])
  expect(await readFile(join(outside, "pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

test("keeps the body byte for byte, indentation and blank lines included", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), body: "    pnpm install\n\n  then run the tests  \n" }
  const created = await createMemoryNote({ path: vault, limits }, "pnpm", note)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }

  const read = await readNote({ path: vault, limits }, "pnpm", note.statement)
  if (!read.succeeded) {
    throw new Error(`setup failed: ${read.problems.join(", ")}`)
  }

  const request = { note: { folder: "pnpm", note: read.output.note }, hashWhenRead: read.output.hash, today }

  await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)

  const archived = { ...note, frontmatter: { ...note.frontmatter, archived: today } }
  expect(await readFile(join(vault, "archive", "pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(archived))
})

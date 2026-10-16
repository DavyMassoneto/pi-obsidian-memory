import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { archiveStoredNote, succeedStoredNote } from "#/services"
import { aDecision, aLimits, aQuestion, putNoteFile, vaultWithNoteToArchive, vaultWithQuestion } from "#test-helpers"

const limits = aLimits()
const today = "2026-10-06"
const question = aQuestion()
const decision = aDecision()

test("refuses with a conflict when the original was deleted since it was read, publishing nothing", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  await rm(file)

  expect(await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readdir(vault)).toEqual(["pnpm"])
  expect(await readdir(join(vault, "pnpm"))).toEqual([])
})

test("refuses a destination that differs only in case, reporting the existing statement and keeping its bytes", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  const existing = note.statement.toUpperCase()
  await putNoteFile(vault, "archive/pnpm", existing, "user note")
  const before = await readFile(file, "utf8")

  expect(await archiveStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: existing,
    problems: [`archive/pnpm/${existing}.md already exists`],
  })
  expect(await readFile(join(vault, "archive", "pnpm", `${existing}.md`), "utf8")).toBe("user note")
  expect(await readFile(file, "utf8")).toBe(before)
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

test("refuses with a conflict when the previous note changed since it was read, changing nothing", async () => {
  const { vault, request, file } = await vaultWithQuestion(today)
  const edited = renderNote({ ...question, body: "Edited in Obsidian." })
  await writeFile(file, edited)

  expect(await succeedStoredNote({ path: vault, name: "Global memory", limits }, request)).toMatchObject({
    succeeded: false,
    reason: "conflict",
  })
  expect(await readFile(file, "utf8")).toBe(edited)
  expect(await readdir(vault)).toEqual(["search"])
  expect(await readdir(join(vault, "search"))).toEqual([`${question.statement}.md`])
})

test("refuses when the successor's name is taken, changing nothing", async () => {
  const { vault, request, file } = await vaultWithQuestion(today)
  await writeFile(join(vault, "search", `${decision.statement}.md`), "user note")
  const before = await readFile(file, "utf8")

  expect(await succeedStoredNote({ path: vault, name: "Global memory", limits }, request)).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: decision.statement,
    problems: [`search/${decision.statement}.md already exists`],
  })
  expect(await readFile(file, "utf8")).toBe(before)
  expect(await readdir(vault)).toEqual(["search"])
})

test("refuses an invalid successor, changing nothing", async () => {
  const { vault, request } = await vaultWithQuestion(today)
  const invalid = { ...request, successor: { folder: "search", note: { ...decision, body: "" } } }

  expect(await succeedStoredNote({ path: vault, name: "Global memory", limits }, invalid)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readdir(vault)).toEqual(["search"])
})

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import type { Note, NoteType } from "#/domain/note"
import { renderNote } from "#/domain/note"
import { createNote, readNote, succeedStoredNote } from "#/services/vault"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }
const today = "2026-10-06"

function noteAbout(statement: string, type: NoteType, id: string): Note {
  const note = aNote()
  return { ...note, statement, frontmatter: { ...note.frontmatter, id, type } }
}

const question = noteAbout("Local or remote embeddings", "question", "01JABCDE7XKQ2M9V3RTN8WPZ5F")
const decision = noteAbout("Chose local embeddings", "decision", "01JABCDE7XKQ2M9V3RTN8WPZ60")

async function vaultWithQuestion() {
  const vault = await useTempVault()
  const created = await createNote(vault, "search", question, limits)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }
  const request = {
    previous: { folder: "search", note: question },
    hashWhenRead: created.output.hash,
    successor: { folder: "search", note: decision },
    today,
  }
  return { vault, request, file: join(vault, "search", `${question.statement}.md`) }
}

test("archives the previous note, writes the successor and links them both ways", async () => {
  const { vault, request } = await vaultWithQuestion()

  const result = await succeedStoredNote(vault, "Global memory", request, limits)

  expect(result).toMatchObject({ succeeded: true })
  expect(await readNote(vault, "archive/search", question.statement)).toMatchObject({
    output: { note: { frontmatter: { archived: today, replacedBy: "[[search/Chose local embeddings]]" } } },
  })
  expect(await readNote(vault, "search", decision.statement)).toMatchObject({
    output: {
      note: {
        frontmatter: { created: today, updated: today, replaces: "[[archive/search/Local or remote embeddings]]" },
      },
    },
  })
  expect(await readNote(vault, "search", question.statement)).toMatchObject({ reason: "not-found" })
})

test("refreshes the indexes of every folder involved", async () => {
  const { vault, request } = await vaultWithQuestion()

  await succeedStoredNote(vault, "Global memory", request, limits)

  const searchIndex = await readFile(join(vault, "search", "index.md"), "utf8")
  expect(searchIndex).toContain(decision.statement)
  expect(searchIndex).not.toContain(question.statement)
  expect(await readFile(join(vault, "archive", "search", "index.md"), "utf8")).toContain(question.statement)
})

test("refuses with a conflict when the previous note changed since it was read, changing nothing", async () => {
  const { vault, request, file } = await vaultWithQuestion()
  const edited = renderNote({ ...question, body: "Edited in Obsidian." })
  await writeFile(file, edited)

  expect(await succeedStoredNote(vault, "Global memory", request, limits)).toMatchObject({
    succeeded: false,
    reason: "conflict",
  })
  expect(await readFile(file, "utf8")).toBe(edited)
  expect(await readdir(vault)).toEqual(["search"])
  expect(await readdir(join(vault, "search"))).toEqual([`${question.statement}.md`])
})

test("refuses when the successor's name is taken, changing nothing", async () => {
  const { vault, request, file } = await vaultWithQuestion()
  await writeFile(join(vault, "search", `${decision.statement}.md`), "user note")
  const before = await readFile(file, "utf8")

  expect(await succeedStoredNote(vault, "Global memory", request, limits)).toEqual({
    succeeded: false,
    reason: "exists",
    problems: [`search/${decision.statement}.md already exists`],
  })
  expect(await readFile(file, "utf8")).toBe(before)
  expect(await readdir(vault)).toEqual(["search"])
})

test("refuses an invalid successor, changing nothing", async () => {
  const { vault, request } = await vaultWithQuestion()
  const invalid = { ...request, successor: { folder: "search", note: { ...decision, body: "" } } }

  expect(await succeedStoredNote(vault, "Global memory", invalid, limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readdir(vault)).toEqual(["search"])
})

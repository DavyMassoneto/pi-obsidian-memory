import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { readNote, succeedStoredNote } from "#/services"
import { aDecision, aLimits, aQuestion, vaultWithQuestion } from "#test-helpers"

const limits = aLimits()
const today = "2026-10-06"

const question = aQuestion()
const decision = aDecision()

test("archives the previous note, writes the successor and links them both ways", async () => {
  const { vault, request } = await vaultWithQuestion(today)

  const result = await succeedStoredNote({ path: vault, name: "Global memory", limits }, request)

  expect(result).toMatchObject({ succeeded: true })
  expect(await readNote({ path: vault, limits }, "archive/search", question.statement)).toMatchObject({
    output: { note: { frontmatter: { archived: today, replacedBy: "[[search/Chose local embeddings]]" } } },
  })
  expect(await readNote({ path: vault, limits }, "search", decision.statement)).toMatchObject({
    output: {
      note: {
        frontmatter: { created: today, updated: today, replaces: "[[archive/search/Local or remote embeddings]]" },
      },
    },
  })
  expect(await readNote({ path: vault, limits }, "search", question.statement)).toMatchObject({ reason: "not-found" })
})

test("refreshes the indexes of every folder involved", async () => {
  const { vault, request } = await vaultWithQuestion(today)

  await succeedStoredNote({ path: vault, name: "Global memory", limits }, request)

  const searchIndex = await readFile(join(vault, "search", "index.md"), "utf8")
  expect(searchIndex).toContain(decision.statement)
  expect(searchIndex).not.toContain(question.statement)
  expect(await readFile(join(vault, "archive", "search", "index.md"), "utf8")).toContain(question.statement)
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

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readNote, succeedStoredNote } from "#src/services"
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

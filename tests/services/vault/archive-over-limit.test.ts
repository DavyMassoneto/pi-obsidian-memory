import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { archiveStoredNote, succeedStoredNote } from "#src/services"
import { aDecision, aLimits, questionWithLongBody, vaultWithNoteToArchive } from "#test-helpers"

const today = "2026-10-06"

test("archives a note whose body exceeds a lowered limit and keeps its content", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive(today)
  const limits = { ...aLimits(), maxBodyChars: 5 }

  const result = await archiveStoredNote({ path: vault, name: "Memory", limits }, request)

  expect(result).toMatchObject({ succeeded: true })
  const archived = join(vault, "archive", "pnpm", `${note.statement}.md`)
  expect(await readFile(archived, "utf8")).toBe(
    renderNote({ ...note, frontmatter: { ...note.frontmatter, archived: today } }),
  )
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
})

test("archives a note whose name exceeds a lowered limit", async () => {
  const { vault, note, request } = await vaultWithNoteToArchive(today)
  const limits = { ...aLimits(), maxStatementChars: 3 }

  expect(await archiveStoredNote({ path: vault, name: "Memory", limits }, request)).toMatchObject({ succeeded: true })

  expect(await readdir(join(vault, "archive", "pnpm"))).toContain(`${note.statement}.md`)
})

test("succeeds an over-limit note when the successor is within the limits", async () => {
  const { vault, question, hashWhenRead } = await questionWithLongBody()
  const successor = { ...aDecision(), body: "Short." }
  const limits = { ...aLimits(), maxBodyChars: 10 }

  const result = await succeedStoredNote(
    { path: vault, name: "Memory", limits },
    {
      previous: { folder: "search", note: question },
      hashWhenRead,
      successor: { folder: "search", note: successor },
      today,
    },
  )

  expect(result).toMatchObject({ succeeded: true })
  expect(await readFile(join(vault, "archive", "search", `${question.statement}.md`), "utf8")).toContain(question.body)
  await expect(readFile(join(vault, "search", `${question.statement}.md`))).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readFile(join(vault, "search", `${successor.statement}.md`), "utf8")).toContain("Short.")
})

test("refuses an over-limit successor and leaves the previous note untouched", async () => {
  const { vault, question, hashWhenRead, text } = await questionWithLongBody()
  const successor = { ...aDecision(), body: "Also longer than the lowered limit." }
  const limits = { ...aLimits(), maxBodyChars: 10 }

  const result = await succeedStoredNote(
    { path: vault, name: "Memory", limits },
    {
      previous: { folder: "search", note: question },
      hashWhenRead,
      successor: { folder: "search", note: successor },
      today,
    },
  )

  expect(result).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(await readFile(join(vault, "search", `${question.statement}.md`), "utf8")).toBe(text)
  expect(await readdir(join(vault, "search"))).toEqual([`${question.statement}.md`])
})

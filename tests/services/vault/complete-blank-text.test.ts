import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { completeBlankFile } from "#src/services"
import { aLimits, aNote, blankFileRequest, catalogVault, putCatalogFile } from "#test-helpers"

test("a file with text and no frontmatter gets frontmatter and keeps its text as the body", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, "Typed in Obsidian.\n\n  indented line  \n")

  const result = await completeBlankFile(vault, { ...request, note: { ...note, body: "ignored" } })

  const body = "Typed in Obsidian.\n\n  indented line  "
  expect(result).toMatchObject({ succeeded: true, output: { note: { ...note, body } } })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(renderNote({ ...note, body }))
  expect((await readFile(join(vault.path, path), "utf8")).endsWith("Typed in Obsidian.\n\n  indented line  \n")).toBe(
    true,
  )
})

test("text without a final newline gets one, and CRLF text is read as LF", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, "first\r\nsecond")

  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: true })

  expect(await readFile(join(vault.path, path), "utf8")).toBe(renderNote({ ...note, body: "first\nsecond" }))
})

test("a text file that changed since the read is left untouched", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, "first draft")
  await putCatalogFile(vault, path, "second draft")

  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "conflict" })

  expect(await readFile(join(vault.path, path), "utf8")).toBe("second draft")
})

test("text that starts an unclosed frontmatter block is refused and left untouched", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const text = "---\nid: 01JABCDE7XKQ2M9V3RTN8WPZ5F\ntype: rule\n"
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, text)

  const result = await completeBlankFile(vault, request)

  expect(result).toMatchObject({ succeeded: false, reason: "not-blank", problems: ["frontmatter is not closed"] })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
})

test("a file that already has closed frontmatter is not blank and is left untouched", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const text = renderNote({ ...note, body: "Existing." })
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, text)

  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "not-blank" })

  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
})

test("text too long for a note body is refused with the problems and left untouched", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const text = "x".repeat(aLimits().maxBodyChars + 1)
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, text)

  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "invalid" })

  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
})

test("an empty file still needs a supplied body", async () => {
  const note = aNote()
  const path = `${note.statement}.md`
  const vault = await catalogVault()
  const request = await blankFileRequest(vault, path, "")

  expect(await completeBlankFile(vault, { ...request, note: { ...note, body: " " } })).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readFile(join(vault.path, path), "utf8")).toBe("")
})

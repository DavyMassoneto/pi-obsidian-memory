import { expect, test } from "vitest"

import { analyzeVaultNote } from "#src/domain"
import { noteText, validFrontmatterLines } from "#test-helpers"

test("valid frontmatter supplies identity independently of invalid text and archive eligibility", () => {
  const request = {
    statement: "bad#name",
    text: noteText(validFrontmatterLines(), ""),
    archived: false,
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
  expect(analyzeVaultNote(request)).toMatchObject({
    status: "parsed",
    searchable: true,
    needsFixing: true,
    frontmatter: { id: "01JABCDE7XKQ2M9V3RTN8WPZ5F" },
    bodyProblems: ["body: is empty"],
  })
  expect(analyzeVaultNote({ ...request, archived: true })).toMatchObject({ searchable: false })
  expect(analyzeVaultNote({ ...request, text: "---\nid: bad" })).toMatchObject({
    status: "unclosed",
    frontmatterProblems: ["frontmatter is not closed"],
    searchable: false,
  })
})

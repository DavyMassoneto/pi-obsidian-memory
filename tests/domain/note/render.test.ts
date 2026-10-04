import { expect, test } from "vitest"

import { renderNote } from "#/domain/note"
import { aNote } from "#test-helpers"

test("writes the frontmatter in a fixed order, then the body after a blank line", () => {
  const note = aNote()
  const { id, type, created, updated } = note.frontmatter
  const shuffled = { ...note, frontmatter: { updated, type, created, id } }

  expect(renderNote(shuffled)).toBe(
    [
      "---",
      "id: 01JABCDE7XKQ2M9V3RTN8WPZ5F",
      "type: rule",
      "created: 2026-10-04",
      "updated: 2026-10-04",
      "---",
      "",
      "Use pnpm for every install and script.",
      "",
    ].join("\n"),
  )
})

test("writes dontForget only when the note is marked", () => {
  const note = aNote()
  const marked = { ...note, frontmatter: { ...note.frontmatter, dontForget: true as const } }

  expect(renderNote(note)).not.toContain("dontForget")
  expect(renderNote(marked)).toContain("updated: 2026-10-04\ndontForget: true\n---")
})

test("writes archived only when the note is archived", () => {
  const note = aNote()
  const archived = { ...note, frontmatter: { ...note.frontmatter, archived: "2026-10-05" } }

  expect(renderNote(note)).not.toContain("archived")
  expect(renderNote(archived)).toContain("updated: 2026-10-04\narchived: 2026-10-05\n---")
})

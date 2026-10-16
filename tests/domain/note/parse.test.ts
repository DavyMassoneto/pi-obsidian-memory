import { expect, test } from "vitest"

import { parseNote, renderNote } from "#src/domain"
import { aNote, noteText, validFrontmatterLines } from "#test-helpers"

const statement = "Use pnpm, never npm"

test("splits the frontmatter text from the body", () => {
  expect(parseNote(statement, noteText(validFrontmatterLines(), "Body."))).toEqual({
    succeeded: true,
    output: { statement, frontmatter: validFrontmatterLines().join("\n"), body: "Body." },
  })
})

test.each([
  ["an indented code block as the first line", "    pnpm install\n    pnpm test"],
  ["leading blank lines", "\n\nUse pnpm."],
  ["trailing spaces", "Use pnpm.  "],
  ["several trailing newlines", "Use pnpm.\n\n\n"],
  ["a leading space", " Use pnpm."],
  ["nothing", ""],
])("keeps a body with %s exactly as renderNote wrote it", (_case, body) => {
  const note = { ...aNote(), body }

  expect(parseNote(note.statement, renderNote(note))).toMatchObject({ succeeded: true, output: { body } })
})

test("removes only the blank line after the frontmatter and the final newline", () => {
  const text = ["---", ...validFrontmatterLines(), "---", "", "  Body.  ", "", ""].join("\n")

  expect(parseNote(statement, text)).toMatchObject({ output: { body: "  Body.  \n" } })
})

test("reads a body that has no final newline", () => {
  const text = ["---", ...validFrontmatterLines(), "---", "", "Body.  "].join("\n")

  expect(parseNote(statement, text)).toMatchObject({ output: { body: "Body.  " } })
})

test("reads a body that starts right after the frontmatter", () => {
  const text = ["---", ...validFrontmatterLines(), "---", "Body.", ""].join("\n")

  expect(parseNote(statement, text)).toMatchObject({ output: { body: "Body." } })
})

test("turns CRLF line endings into LF", () => {
  const text = ["---", ...validFrontmatterLines(), "---", "", "Line one", "Line two", ""].join("\r\n")

  expect(parseNote(statement, text)).toEqual({
    succeeded: true,
    output: { statement, frontmatter: validFrontmatterLines().join("\n"), body: "Line one\nLine two" },
  })
})

test("keeps frontmatter text that is not valid YAML, for validation to report", () => {
  expect(parseNote(statement, noteText(["id: [unclosed"], "Body."))).toMatchObject({
    succeeded: true,
    output: { frontmatter: "id: [unclosed", body: "Body." },
  })
})

test("fails without frontmatter", () => {
  expect(parseNote(statement, "Just a body.\n")).toEqual({ succeeded: false, problems: ["missing frontmatter"] })
})

test("fails when the frontmatter is not closed", () => {
  expect(parseNote(statement, "---\nid: 01JABCDE7XKQ2M9V3RTN8WPZ5F\n")).toEqual({
    succeeded: false,
    problems: ["frontmatter is not closed"],
  })
})

test("ends the frontmatter at the first line that is exactly ---", () => {
  const text = ["---", "id: x", "---", "more: y", "---", "Body.", ""].join("\n")

  expect(parseNote(statement, text)).toEqual({
    succeeded: true,
    output: { statement, frontmatter: "id: x", body: "more: y\n---\nBody." },
  })
})

test("keeps a line that only starts with --- inside the frontmatter", () => {
  const text = ["---", "id: x", "--- not a fence", "---", "Body.", ""].join("\n")

  expect(parseNote(statement, text)).toMatchObject({ output: { frontmatter: "id: x\n--- not a fence", body: "Body." } })
})

test("reads an empty frontmatter when the closing --- comes right after the opening one", () => {
  const text = ["---", "---", "id: x", "Body.", ""].join("\n")

  expect(parseNote(statement, text)).toEqual({
    succeeded: true,
    output: { statement, frontmatter: "", body: "id: x\nBody." },
  })
})

import { expect, test } from "vitest"

import { renderNote, validateNote } from "#src/domain"
import { aConfig, aNote, aParsedNote, frontmatterLinesWith, readBack, validFrontmatterLines } from "#test-helpers"

const limits = aConfig().limits

test("reads back exactly the note that renderNote wrote", () => {
  const note = aNote()
  const full = { ...note, frontmatter: { ...note.frontmatter, dontForget: true as const, archived: "2026-10-05" } }

  expect(readBack(renderNote(note))).toEqual({ succeeded: true, output: note })
  expect(readBack(renderNote(full))).toEqual({ succeeded: true, output: full })
})

test.each([
  ["an indented code block as the first line", "    pnpm install\n    pnpm test"],
  ["leading blank lines", "\n\nUse pnpm."],
  ["several trailing newlines", "Use pnpm.\n\n\n"],
])("reads back a body with %s unchanged", (_case, body) => {
  const note = { ...aNote(), body }

  expect(readBack(renderNote(note))).toEqual({ succeeded: true, output: note })
})

test("accepts a note written by hand in Obsidian", () => {
  const text =
    "---\r\nupdated:   2026-10-05\r\ncreated: 2026-10-04\r\ntype: lesson\r\nid: 01JABCDE7XKQ2M9V3RTN8WPZ5F\r\n---\r\nBody.\r\n"

  expect(readBack(text)).toEqual({
    succeeded: true,
    output: {
      statement: aNote().statement,
      frontmatter: { id: "01JABCDE7XKQ2M9V3RTN8WPZ5F", type: "lesson", created: "2026-10-04", updated: "2026-10-05" },
      body: "Body.",
    },
  })
})

test("reads the lifecycle links and keeps dates as YYYY-MM-DD text", () => {
  const lines = [...validFrontmatterLines(), 'replaces: "[[archive/search/Old]]"', 'replacedBy: "[[search/New]]"']

  expect(validateNote(aParsedNote(lines, "Body."), limits)).toMatchObject({
    succeeded: true,
    output: {
      frontmatter: { created: "2026-10-04", replaces: "[[archive/search/Old]]", replacedBy: "[[search/New]]" },
    },
  })
})

test("reports the frontmatter, statement and body problems together", () => {
  const parsed = { ...aParsedNote(frontmatterLinesWith("id: 12345"), ""), statement: "Use a: b" }

  expect(validateNote(parsed, limits)).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^id:/), 'statement: ":" is not allowed in a file name', "body: is empty"],
  })
})

test.each([
  ["an empty body", "", limits, "body: is empty"],
  [
    "a body over a lowered limit",
    "a".repeat(20),
    { ...limits, maxBodyChars: 10 },
    "body: has 20 characters, the limit is 10",
  ],
])("reports a note with valid frontmatter and %s", (_case, body, given, problem) => {
  expect(validateNote(aParsedNote(validFrontmatterLines(), body), given)).toEqual({
    succeeded: false,
    problems: [problem],
  })
})

test("reports a repeated field with every other frontmatter, statement and body problem, and nothing else", () => {
  const lines = ["id: 01JABCDE7XKQ2M9V3RTN8WPZ5F", "id: 01JABCDE7XKQ2M9V3RTN8WPZ60", "type: rule"]
  const parsed = {
    ...aParsedNote([...lines, "created: nonsense", "updated: 2026-10-04", "bogus: 1"], ""),
    statement: "Use a: b",
  }

  expect(validateNote(parsed, limits)).toEqual({
    succeeded: false,
    problems: [
      "id: appears more than once",
      "created: must be a date (YYYY-MM-DD)",
      "bogus: not a known field",
      'statement: ":" is not allowed in a file name',
      "body: is empty",
    ],
  })
})

test("reports a frontmatter that is not valid YAML together with the statement and body problems", () => {
  const parsed = { ...aParsedNote(["id: [unclosed"], ""), statement: "Use a: b" }

  expect(validateNote(parsed, limits)).toEqual({
    succeeded: false,
    problems: [
      expect.stringMatching(/^frontmatter: /),
      'statement: ":" is not allowed in a file name',
      "body: is empty",
    ],
  })
})

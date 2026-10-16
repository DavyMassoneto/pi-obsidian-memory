import { expect, test } from "vitest"

import { checkNote } from "#src/domain"
import { aConfig, aNote, aNoteWithBody, aNoteWithStatement } from "#test-helpers"

const limits = aConfig().limits

test("finds no problems in a valid note", () => {
  expect(checkNote(aNote(), limits)).toEqual([])
})

test("accepts dot-prefixed statements", () => {
  expect(checkNote(aNoteWithStatement(".Visible"), limits)).toEqual([])
})

test("accepts a body exactly at the limit and refuses one character more", () => {
  expect(checkNote(aNoteWithBody("a".repeat(1000)), limits)).toEqual([])
  expect(checkNote(aNoteWithBody("a".repeat(1001)), limits)).toEqual(["body: has 1001 characters, the limit is 1000"])
})

test("counts characters as people do", () => {
  const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"
  const combinedAccent = "e\u0301"

  expect(family).toHaveLength(8)
  expect(combinedAccent).toHaveLength(2)

  expect(checkNote(aNoteWithBody(family.repeat(1000)), limits)).toEqual([])
  expect(checkNote(aNoteWithBody(combinedAccent.repeat(1000)), limits)).toEqual([])
  expect(checkNote(aNoteWithStatement(family.repeat(100)), limits)).toEqual([])
})

test.each([
  ["empty", ""],
  ["only whitespace", "  \n\t "],
])("refuses a body that is %s", (_case, body) => {
  expect(checkNote(aNoteWithBody(body), limits)).toEqual(["body: is empty"])
})

test("accepts a statement exactly at the limit and refuses one character more", () => {
  expect(checkNote(aNoteWithStatement("a".repeat(100)), limits)).toEqual([])
  expect(checkNote(aNoteWithStatement("a".repeat(101)), limits)).toEqual([
    "statement: has 101 characters, the limit is 100",
  ])
})

test("refuses an empty statement", () => {
  expect(checkNote(aNoteWithStatement("   "), limits)).toEqual(["statement: is empty"])
})

test.each(["<", ">", ":", '"', "/", "\\", "|", "?", "*"])(
  "refuses %s, not allowed in Windows file names",
  (character) => {
    expect(checkNote(aNoteWithStatement(`Use a ${character} b`), limits)).toEqual([
      `statement: "${character}" is not allowed in a file name`,
    ])
  },
)

test.each(["[", "]", "#", "^"])("refuses %s, which breaks Obsidian links", (character) => {
  expect(checkNote(aNoteWithStatement(`Use a ${character} b`), limits)).toEqual([
    `statement: "${character}" breaks Obsidian links`,
  ])
})

test("refuses control characters", () => {
  expect(checkNote(aNoteWithStatement("Use\ta tab"), limits)).toEqual(["statement: has a control character"])
})

test.each(["CON", "nul", "Com1", "LPT9", "AUX.notes"])("refuses %s, reserved by Windows", (statement) => {
  expect(checkNote(aNoteWithStatement(statement), limits)).toEqual([`statement: "${statement}" is reserved by Windows`])
})

test.each(["index", "Index", "INDEX"])("refuses %s, reserved for folder indexes", (statement) => {
  expect(checkNote(aNoteWithStatement(statement), limits)).toEqual([
    `statement: "${statement}" is reserved for folder indexes`,
  ])
})

test("accepts a statement that only starts like a reserved name", () => {
  expect(checkNote(aNoteWithStatement("Console output is buffered"), limits)).toEqual([])
})

test.each([
  ["a leading space", " Use pnpm", "statement: starts or ends with a space"],
  ["a trailing space", "Use pnpm ", "statement: starts or ends with a space"],
  ["a trailing dot", "Use pnpm.", "statement: ends with a dot"],
])("refuses a statement with %s", (_case, statement, problem) => {
  expect(checkNote(aNoteWithStatement(statement), limits)).toEqual([problem])
})

test("lists every problem at once", () => {
  const note = { ...aNote(), statement: "Use a: b?", body: "" }

  expect(checkNote(note, limits)).toEqual([
    'statement: ":" is not allowed in a file name',
    'statement: "?" is not allowed in a file name',
    "body: is empty",
  ])
})

test("refuses a frontmatter that the format does not allow, with the other problems", () => {
  const note = aNote()
  const invalid = { ...note, frontmatter: { ...note.frontmatter, id: "not-a-ulid", created: "2026-02-30" }, body: "" }

  expect(checkNote(invalid, limits)).toEqual([
    "id: must be a ULID",
    "created: must be a date (YYYY-MM-DD)",
    "body: is empty",
  ])
})

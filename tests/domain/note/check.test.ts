import { expect, test } from "vitest"

import { checkNote } from "#/domain/note"
import { aNote } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

function withStatement(statement: string) {
  return { ...aNote(), statement }
}

function withBody(body: string) {
  return { ...aNote(), body }
}

test("finds no problems in a valid note", () => {
  expect(checkNote(aNote(), limits)).toEqual([])
})

test("accepts a body exactly at the limit and refuses one character more", () => {
  expect(checkNote(withBody("a".repeat(1000)), limits)).toEqual([])
  expect(checkNote(withBody("a".repeat(1001)), limits)).toEqual(["body: has 1001 characters, the limit is 1000"])
})

test("counts characters as people do", () => {
  const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"
  const combinedAccent = "e\u0301"

  expect(family).toHaveLength(8)
  expect(combinedAccent).toHaveLength(2)

  expect(checkNote(withBody(family.repeat(1000)), limits)).toEqual([])
  expect(checkNote(withBody(combinedAccent.repeat(1000)), limits)).toEqual([])
  expect(checkNote(withStatement(family.repeat(100)), limits)).toEqual([])
})

test.each([
  ["empty", ""],
  ["only whitespace", "  \n\t "],
])("refuses a body that is %s", (_case, body) => {
  expect(checkNote(withBody(body), limits)).toEqual(["body: is empty"])
})

test("accepts a statement exactly at the limit and refuses one character more", () => {
  expect(checkNote(withStatement("a".repeat(100)), limits)).toEqual([])
  expect(checkNote(withStatement("a".repeat(101)), limits)).toEqual(["statement: has 101 characters, the limit is 100"])
})

test("refuses an empty statement", () => {
  expect(checkNote(withStatement("   "), limits)).toEqual(["statement: is empty"])
})

test.each(["<", ">", ":", '"', "/", "\\", "|", "?", "*"])(
  "refuses %s, not allowed in Windows file names",
  (character) => {
    expect(checkNote(withStatement(`Use a ${character} b`), limits)).toEqual([
      `statement: "${character}" is not allowed in a file name`,
    ])
  },
)

test.each(["[", "]", "#", "^"])("refuses %s, which breaks Obsidian links", (character) => {
  expect(checkNote(withStatement(`Use a ${character} b`), limits)).toEqual([
    `statement: "${character}" breaks Obsidian links`,
  ])
})

test("refuses control characters", () => {
  expect(checkNote(withStatement("Use\ta tab"), limits)).toEqual(["statement: has a control character"])
})

test.each(["CON", "nul", "Com1", "LPT9", "AUX.notes"])("refuses %s, reserved by Windows", (statement) => {
  expect(checkNote(withStatement(statement), limits)).toEqual([`statement: "${statement}" is reserved by Windows`])
})

test.each(["index", "Index", "INDEX"])("refuses %s, reserved for folder indexes", (statement) => {
  expect(checkNote(withStatement(statement), limits)).toEqual([
    `statement: "${statement}" is reserved for folder indexes`,
  ])
})

test("accepts a statement that only starts like a reserved name", () => {
  expect(checkNote(withStatement("Console output is buffered"), limits)).toEqual([])
})

test.each([
  ["a leading space", " Use pnpm", "statement: starts or ends with a space"],
  ["a trailing space", "Use pnpm ", "statement: starts or ends with a space"],
  ["a trailing dot", "Use pnpm.", "statement: ends with a dot"],
])("refuses a statement with %s", (_case, statement, problem) => {
  expect(checkNote(withStatement(statement), limits)).toEqual([problem])
})

test("lists every problem at once", () => {
  const note = { ...aNote(), statement: "Use a: b?", body: "" }

  expect(checkNote(note, limits)).toEqual([
    'statement: ":" is not allowed in a file name',
    'statement: "?" is not allowed in a file name',
    "body: is empty",
  ])
})

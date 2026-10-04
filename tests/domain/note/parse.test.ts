import { expect, test } from "vitest"

import { parseNote, renderNote } from "#/domain/note"
import { aNote } from "#test-helpers"

const statement = "Use pnpm, never npm"

function frontmatterWith(lines: string[]): string {
  return ["---", ...lines, "---", "", "Body.", ""].join("\n")
}

const validLines = ["id: 01JABCDE7XKQ2M9V3RTN8WPZ5F", "type: rule", "created: 2026-10-04", "updated: 2026-10-04"]

test("reads back exactly the note that renderNote wrote", () => {
  const note = aNote()
  const full = { ...note, frontmatter: { ...note.frontmatter, dontForget: true as const, archived: "2026-10-05" } }

  expect(parseNote(note.statement, renderNote(note))).toEqual({ succeeded: true, output: note })
  expect(parseNote(full.statement, renderNote(full))).toEqual({ succeeded: true, output: full })
})

test("accepts a note written by hand in Obsidian", () => {
  const text =
    "---\r\nupdated:   2026-10-05\r\ncreated: 2026-10-04\r\ntype: lesson\r\nid: 01JABCDE7XKQ2M9V3RTN8WPZ5F\r\n---\r\nBody.\r\n"

  expect(parseNote(statement, text)).toEqual({
    succeeded: true,
    output: {
      statement,
      frontmatter: { id: "01JABCDE7XKQ2M9V3RTN8WPZ5F", type: "lesson", created: "2026-10-04", updated: "2026-10-05" },
      body: "Body.",
    },
  })
})

test("keeps dates as YYYY-MM-DD text", () => {
  const result = parseNote(statement, frontmatterWith(validLines))

  expect(result).toMatchObject({ succeeded: true, output: { frontmatter: { created: "2026-10-04" } } })
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

test.each([
  ["an id that is not a ULID", "id: 12345", "id:"],
  ["a type outside the list", "type: wish", "type:"],
  ["an impossible date", "created: 2026-02-30", "created:"],
  ["a date in another format", "updated: 04/10/2026", "updated:"],
  ["a field that is not in the format", "tags: [important]", "tags:"],
])("fails with %s", (_case, line, problemPrefix) => {
  const field = line.split(":")[0]
  const lines = [...validLines.filter((validLine) => !validLine.startsWith(`${field}:`)), line]

  expect(parseNote(statement, frontmatterWith(lines))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(new RegExp(`^${problemPrefix}`))],
  })
})

test("lists every problem at once", () => {
  const result = parseNote(statement, frontmatterWith(["id: 12345", "type: wish", "created: 2026-02-30"]))

  expect(result).toEqual({
    succeeded: false,
    problems: expect.arrayContaining([
      expect.stringMatching(/^id:/),
      expect.stringMatching(/^type:/),
      expect.stringMatching(/^created:/),
      expect.stringMatching(/^frontmatter:.*updated/),
    ]),
  })
})

test("fails when the frontmatter is not valid YAML", () => {
  expect(parseNote(statement, frontmatterWith(["id: [unclosed"]))).toMatchObject({
    succeeded: false,
    problems: [expect.stringMatching(/^frontmatter:/)],
  })
})

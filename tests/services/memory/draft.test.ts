import { Value } from "typebox/value"
import { decodeTime } from "ulid"
import { afterEach, expect, test, vi } from "vitest"

import { NoteFrontmatterSchema } from "#/domain/note"
import { newNote } from "#/services/memory"

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

afterEach(() => {
  vi.useRealTimers()
})

test("builds a note born today, with a new id stamped now", () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 6, 14, 0))

  const note = newNote(draft)

  expect(note).toMatchObject({
    statement: draft.statement,
    body: draft.body,
    frontmatter: { type: "rule", created: "2026-10-06", updated: "2026-10-06" },
  })
  expect(Value.Check(NoteFrontmatterSchema, note.frontmatter)).toBe(true)
  expect(decodeTime(note.frontmatter.id)).toBe(new Date(2026, 9, 6, 14, 0).getTime())
})

test.each([
  ["late at night", new Date(2026, 9, 6, 23, 30), "2026-10-06"],
  ["just after midnight", new Date(2026, 9, 7, 0, 10), "2026-10-07"],
])("dates the note with the local day %s", (_case, now, day) => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(now)

  expect(newNote(draft).frontmatter).toMatchObject({ created: day, updated: day })
})

test("marks the note as don't forget only when asked", () => {
  expect(newNote({ ...draft, dontForget: true }).frontmatter.dontForget).toBe(true)
  expect(newNote(draft).frontmatter).not.toHaveProperty("dontForget")
})

test("gives every note its own id", () => {
  expect(newNote(draft).frontmatter.id).not.toBe(newNote(draft).frontmatter.id)
})

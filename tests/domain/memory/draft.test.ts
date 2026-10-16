import { expect, test } from "vitest"

import { newNote } from "#src/domain"

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV"
const day = "2026-10-06"

test("builds a note using only the supplied draft, id and day", () => {
  expect(newNote(draft, id, day)).toEqual({
    statement: draft.statement,
    body: draft.body,
    frontmatter: { id, type: "rule", created: day, updated: day },
  })
})

test("marks the note as don't forget only when asked", () => {
  expect(newNote({ ...draft, dontForget: true }, id, day).frontmatter.dontForget).toBe(true)
  expect(newNote(draft, id, day).frontmatter).not.toHaveProperty("dontForget")
})

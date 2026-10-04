import { expect, test } from "vitest"

import { createNote, findNote } from "#/services/vault"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("finds a note by its statement in any case, returning its real statement", async () => {
  const vault = await useTempVault()
  const note = aNote()
  const created = await createNote(vault, "pnpm", note, limits)

  expect(await findNote(vault, "pnpm", note.statement.toUpperCase())).toEqual(created)
})

test("tells when no note has that statement", async () => {
  const vault = await useTempVault()

  expect(await findNote(vault, "pnpm", "Missing note")).toEqual({
    succeeded: false,
    reason: "not-found",
    problems: ["pnpm/Missing note.md does not exist"],
  })
})

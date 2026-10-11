import { join } from "node:path"

import { expect, test } from "vitest"

import { createMemoryNote, findNote } from "#/services"
import { aNote, linkFolder, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("finds a note by its statement in any case, returning its real statement", async () => {
  const vault = await useTempVault()
  const note = aNote()
  const created = await createMemoryNote(vault, "pnpm", note, limits)

  expect(await findNote(vault, "pnpm", note.statement.toUpperCase(), limits)).toEqual(created)
})

test("tells when no note has that statement", async () => {
  const vault = await useTempVault()

  expect(await findNote(vault, "pnpm", "Missing note", limits)).toEqual({
    succeeded: false,
    reason: "not-found",
    problems: ["pnpm/Missing note.md does not exist"],
  })
})

test("refuses to search through a link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const note = aNote()
  await createMemoryNote(outside, "", note, limits)
  await linkFolder(outside, join(vault, "escape"))

  expect(await findNote(vault, "escape", note.statement, limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

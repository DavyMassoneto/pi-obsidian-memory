import { join } from "node:path"

import { expect, test } from "vitest"

import { createMemoryNote, findNote } from "#src/services"
import { aLimits, aNote, linkFolder, useTempFolder } from "#test-helpers"

const limits = aLimits()

test("finds a note by its statement in any case, returning its real statement", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  const created = await createMemoryNote({ path: vault, limits }, "pnpm", note)

  expect(await findNote({ path: vault, limits }, "pnpm", note.statement.toUpperCase())).toEqual(created)
})

test("tells when no note has that statement", async () => {
  const vault = await useTempFolder()

  expect(await findNote({ path: vault, limits }, "pnpm", "Missing note")).toEqual({
    succeeded: false,
    reason: "not-found",
    problems: ["pnpm/Missing note.md does not exist"],
  })
})

test("refuses to search through a link that leads outside the vault", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  const note = aNote()
  await createMemoryNote({ path: outside, limits }, "", note)
  await linkFolder(outside, join(vault, "escape"))

  expect(await findNote({ path: vault, limits }, "escape", note.statement)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

import { realpath } from "node:fs/promises"

import { expect, test } from "vitest"

import { receiptedNote } from "#src/usecases"
import { changeFixture, noteWithId, READIED_PATH as path, putCatalogFile, readiedNote } from "#test-helpers"

test("a note read in this session gives its note, folder and the exact read", async () => {
  const { context, vault } = await readiedNote("Always pnpm.", ["dontForget: true"])

  const result = receiptedNote(context, { vault: "global", path }, await realpath(vault.path))

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      folder: "tools",
      note: {
        statement: "Use pnpm",
        body: "Always pnpm.",
        frontmatter: { id: "01JABCDE7XKQ2M9V3RTN8WPZ01", type: "rule", dontForget: true },
      },
      read: { path, vault: "global" },
    },
  })
})

test("a note at the vault root has the empty folder", async () => {
  const { context, vault, read } = await changeFixture()
  await putCatalogFile(vault, "Root.md", noteWithId(1, "At the root.", []))
  await read("global", "Root.md")

  const result = receiptedNote(context, { vault: "global", path: "Root.md" }, await realpath(vault.path))

  expect(result).toMatchObject({ succeeded: true, output: { folder: "" } })
})

test("a note never read is refused as not read", async () => {
  const { context, vault } = await readiedNote("Always pnpm.", [])

  const result = receiptedNote(context, { vault: "global", path: "tools/Other.md" }, await realpath(vault.path))

  expect(result).toMatchObject({
    succeeded: false,
    reason: "not-read",
    problems: [expect.stringContaining("Other.md")],
  })
})

test("another spelling of the path counts as not read", async () => {
  const { context, vault } = await readiedNote("Always pnpm.", [])

  const result = receiptedNote(context, { vault: "global", path: "tools/use pnpm.md" }, await realpath(vault.path))

  expect(result).toMatchObject({ succeeded: false, reason: "not-read" })
})

test("a read made for another vault location is refused as a changed vault", async () => {
  const { context } = await readiedNote("Always pnpm.", [])

  const result = receiptedNote(context, { vault: "global", path }, "D:/somewhere/else")

  expect(result).toMatchObject({ succeeded: false, reason: "stale-vault" })
})

test("an archived note that was read is refused as archived", async () => {
  const { context, vault, read } = await changeFixture()
  await putCatalogFile(vault, "archive/Old.md", noteWithId(2, "Old.", ["archived: 2026-10-01"]))
  await read("global", "archive/Old.md")

  const result = receiptedNote(context, { vault: "global", path: "archive/Old.md" }, await realpath(vault.path))

  expect(result).toMatchObject({ succeeded: false, reason: "archived" })
})

test("a note with invalid frontmatter that was read is refused as needing fixing", async () => {
  const { context, vault, read } = await changeFixture()
  await putCatalogFile(vault, "Odd.md", noteWithId(1, "Odd.", ["colour: red"]))
  await read("global", "Odd.md")

  const result = receiptedNote(context, { vault: "global", path: "Odd.md" }, await realpath(vault.path))

  expect(result).toMatchObject({ succeeded: false, reason: "needs-fixing" })
})

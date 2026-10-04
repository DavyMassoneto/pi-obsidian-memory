import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { createNote, listFolder } from "#/services/vault"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("lists the subfolders as subjects and the valid notes of a folder", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createNote(vault, "tools", note, limits)
  await mkdir(join(vault, "tools", "pnpm"))

  expect(await listFolder(vault, "tools")).toEqual({ subjects: ["pnpm"], notes: [note], invalid: [] })
})

test("leaves out the index, hidden files and folders, and files that are not notes", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, ".obsidian"))
  await writeFile(join(vault, "index.md"), "# generated")
  await writeFile(join(vault, ".Use pnpm.md.tmp-123"), "temporary")
  await writeFile(join(vault, "diagram.png"), "image")

  expect(await listFolder(vault, "")).toEqual({ subjects: [], notes: [], invalid: [] })
})

test("leaves out archive and _templates at the vault root", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "archive"))
  await mkdir(join(vault, "_templates"))
  await mkdir(join(vault, "pnpm"))

  expect((await listFolder(vault, "")).subjects).toEqual(["pnpm"])
})

test("lists archive and _templates as ordinary subjects below the root", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "tools", "archive"), { recursive: true })
  await mkdir(join(vault, "tools", "_templates"))

  expect((await listFolder(vault, "tools")).subjects.sort()).toEqual(["_templates", "archive"])
})

test("lists invalid notes with their problems", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Broken.md"), "No frontmatter.\n")

  expect(await listFolder(vault, "")).toEqual({
    subjects: [],
    notes: [],
    invalid: [{ statement: "Broken", problems: ["missing frontmatter"] }],
  })
})

import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { readNote } from "#/services"
import { aNote, linkFolder, tryLinkFile, useTempVault } from "#test-helpers"

async function putNote(vault: string, folder: string, statement: string, text: string): Promise<void> {
  await mkdir(join(vault, folder), { recursive: true })
  await writeFile(join(vault, folder, `${statement}.md`), text)
}

test("reads a note and the hash of its bytes, accents and emoji included", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), body: "Café — pnpm é obrigatório 🚀" }
  const text = renderNote(note)
  await putNote(vault, "pnpm", note.statement, text)

  expect(await readNote(vault, "pnpm", note.statement)).toEqual({
    succeeded: true,
    output: { note, hash: createHash("sha256").update(text).digest("hex") },
  })
})

test("reads a note in a nested folder", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await putNote(vault, "tools/pnpm", note.statement, renderNote(note))

  expect(await readNote(vault, "tools/pnpm", note.statement)).toMatchObject({ succeeded: true, output: { note } })
})

test("tells when the note does not exist", async () => {
  const vault = await useTempVault()

  expect(await readNote(vault, "pnpm", "Missing note")).toEqual({
    succeeded: false,
    reason: "not-found",
    problems: ["pnpm/Missing note.md does not exist"],
  })
})

test("tells when the note on disk is invalid, with every problem", async () => {
  const vault = await useTempVault()
  await putNote(vault, "pnpm", "Broken", "No frontmatter here.\n")

  expect(await readNote(vault, "pnpm", "Broken")).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["missing frontmatter"],
  })
})

test("refuses to read through a link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const note = aNote()
  await putNote(outside, "", note.statement, renderNote(note))
  await linkFolder(outside, join(vault, "escape"))

  expect(await readNote(vault, "escape", note.statement)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test("refuses to read a note that is a file link leading outside the vault", async (context) => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const note = aNote()
  await putNote(outside, "", note.statement, renderNote(note))
  await mkdir(join(vault, "pnpm"))
  const linked = await tryLinkFile(join(outside, `${note.statement}.md`), join(vault, "pnpm", `${note.statement}.md`))
  if (!linked) {
    context.skip("this system cannot create file links")
  }

  expect(await readNote(vault, "pnpm", note.statement)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: [`pnpm/${note.statement}.md leads outside the vault`],
  })
})

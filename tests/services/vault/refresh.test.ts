import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { createNote, refreshIndexes } from "#/services/vault"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

async function readIndex(vault: string, folder: string): Promise<string> {
  return readFile(join(vault, folder, "index.md"), "utf8")
}

test("writes the index of the folder and of every folder above it, up to the root", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createNote(vault, "tools/pnpm", note, limits)

  expect(await refreshIndexes(vault, "tools/pnpm", "Global memory")).toEqual({ succeeded: true })

  expect(await readIndex(vault, "tools/pnpm")).toContain(`- [[tools/pnpm/${note.statement}|${note.statement}]] · rule`)
  expect(await readIndex(vault, "tools")).toContain("- [[tools/pnpm/index|pnpm]]")
  expect(await readIndex(vault, "")).toContain("# Global memory\n\n## Subjects\n\n- [[tools/index|tools]]")
})

test("adds the Archive section to the root index when the vault has an archive", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "archive"))

  await refreshIndexes(vault, "", "Global memory")

  expect(await readIndex(vault, "")).toContain("## Archive\n\n- [[archive/index|archive]]")
})

test("overwrites an index edited by hand", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "index.md"), "edited by hand")

  await refreshIndexes(vault, "", "Global memory")

  expect(await readIndex(vault, "")).toBe("# Global memory\n")
})

test("lists invalid notes under Needs fixing", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Broken.md"), "No frontmatter.\n")

  await refreshIndexes(vault, "", "Global memory")

  expect(await readIndex(vault, "")).toContain("## Needs fixing\n\n- [[Broken|Broken]] · missing frontmatter")
})

test("leaves no temporary file behind", async () => {
  const vault = await useTempVault()
  await createNote(vault, "pnpm", aNote(), limits)

  await refreshIndexes(vault, "pnpm", "Global memory")

  expect((await readdir(join(vault, "pnpm"))).sort()).toEqual([`${aNote().statement}.md`, "index.md"].sort())
})

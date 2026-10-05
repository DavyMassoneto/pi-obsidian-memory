import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { createNote, refreshIndexes } from "#/services"
import { aNote, linkFolder, tryLinkFile, useTempVault } from "#test-helpers"

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

test("refuses to write an index through a link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "escape"))

  expect(await refreshIndexes(vault, "escape", "Global memory")).toEqual({
    succeeded: false,
    problems: ["escape leads outside the vault"],
  })
  expect(await readdir(outside)).toEqual([])
})

test("refuses to replace an index that is a link leading outside the vault, leaving its target unchanged", async (context) => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const target = join(outside, "notes.md")
  await writeFile(target, "outside")
  const linked = await tryLinkFile(target, join(vault, "index.md"))
  if (!linked) {
    context.skip("this system cannot create file links")
  }

  expect(await refreshIndexes(vault, "", "Global memory")).toEqual({
    succeeded: false,
    problems: ["index.md leads outside the vault"],
  })
  expect(await readFile(target, "utf8")).toBe("outside")
  expect(await readdir(vault)).toEqual(["index.md"])
})

test.each([
  ["a leading slash", "/tools", "folder: must be relative to the vault"],
  ["the root as a slash", "/", "folder: must be relative to the vault"],
  ["an empty part", "tools//pnpm", "folder: has an empty part"],
  ["a trailing slash", "tools/", "folder: has an empty part"],
])("refuses a folder with %s, leaving every index as it was", async (_case, folder, problem) => {
  const vault = await useTempVault()
  await mkdir(join(vault, "tools", "pnpm"), { recursive: true })
  for (const indexFolder of ["", "tools", "tools/pnpm"]) {
    await writeFile(join(vault, indexFolder, "index.md"), `edited ${indexFolder}`)
  }

  expect(await refreshIndexes(vault, folder, "Global memory")).toEqual({ succeeded: false, problems: [problem] })
  for (const indexFolder of ["", "tools", "tools/pnpm"]) {
    expect(await readIndex(vault, indexFolder)).toBe(`edited ${indexFolder}`)
  }
})

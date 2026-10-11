import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, refreshIndexes } from "#/services"
import {
  aNote,
  linkFolder,
  noteText,
  readIndexOf,
  tryLinkFile,
  useTempVault,
  validFrontmatterLines,
} from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("returns not-found for a missing folder without writing ancestor indexes", async () => {
  const vault = await useTempVault()
  expect(await refreshIndexes(vault, "missing/deep", "Memory", limits)).toMatchObject({
    succeeded: false,
    reason: "not-found",
  })
  expect(await readdir(vault)).toEqual([])
})

test("does not advertise a regular archive file as the archive folder", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "archive"), "user content")
  expect(await refreshIndexes(vault, "", "Memory", limits)).toMatchObject({ succeeded: true })
  expect(await readIndexOf(vault, "")).not.toContain("## Archive")
})

test("writes an internal index alias target without replacing the link", async (context) => {
  const vault = await useTempVault()
  const target = join(vault, "map.txt")
  await writeFile(target, "old index")
  const alias = join(vault, "index.md")
  if (!(await tryLinkFile(target, alias))) {
    context.skip("this system cannot create file links")
    return
  }
  expect(await refreshIndexes(vault, "", "Memory", limits)).toEqual({ succeeded: true })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readFile(target, "utf8")).toBe("# Memory\n")
})

test("indexes a valid dot-prefixed note and excludes actual temporary files", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), statement: ".Invisible" }
  await createMemoryNote(vault, "", note, limits)
  await writeFile(join(vault, ".Invisible.md.tmp-123"), "temporary")
  expect(await refreshIndexes(vault, "", "Memory", limits)).toEqual({ succeeded: true })
  expect(await readIndexOf(vault, "")).toContain("[[.Invisible|.Invisible]]")
  expect(await readIndexOf(vault, "")).not.toContain("tmp-123")
})

test("writes the index of the folder and of every folder above it, up to the root", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createMemoryNote(vault, "tools/pnpm", note, limits)

  expect(await refreshIndexes(vault, "tools/pnpm", "Global memory", limits)).toEqual({ succeeded: true })

  expect(await readIndexOf(vault, "tools/pnpm")).toContain(
    `- [[tools/pnpm/${note.statement}|${note.statement}]] · rule`,
  )
  expect(await readIndexOf(vault, "tools")).toContain("- [[tools/pnpm/index|pnpm]]")
  expect(await readIndexOf(vault, "")).toContain("# Global memory\n\n## Subjects\n\n- [[tools/index|tools]]")
})

test("adds the Archive section to the root index when the vault has an archive", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "archive"))

  await refreshIndexes(vault, "", "Global memory", limits)

  expect(await readIndexOf(vault, "")).toContain("## Archive\n\n- [[archive/index|archive]]")
})

test("overwrites an index edited by hand", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "index.md"), "edited by hand")

  await refreshIndexes(vault, "", "Global memory", limits)

  expect(await readIndexOf(vault, "")).toBe("# Global memory\n")
})

test("lists invalid notes under Needs fixing", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Broken.md"), "No frontmatter.\n")

  await refreshIndexes(vault, "", "Global memory", limits)

  expect(await readIndexOf(vault, "")).toContain("## Needs fixing\n\n- [[Broken|Broken]] · missing frontmatter")
})

test("leaves no temporary file behind", async () => {
  const vault = await useTempVault()
  await createMemoryNote(vault, "pnpm", aNote(), limits)

  await refreshIndexes(vault, "pnpm", "Global memory", limits)

  expect((await readdir(join(vault, "pnpm"))).sort()).toEqual([`${aNote().statement}.md`, "index.md"].sort())
})

test("refuses to write an index through a link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "escape"))

  expect(await refreshIndexes(vault, "escape", "Global memory", limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
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

  expect(await refreshIndexes(vault, "", "Global memory", limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
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

  expect(await refreshIndexes(vault, folder, "Global memory", limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: [problem],
  })

  for (const indexFolder of ["", "tools", "tools/pnpm"]) {
    expect(await readIndexOf(vault, indexFolder)).toBe(`edited ${indexFolder}`)
  }
})

test("lists a note with an empty body under Needs fixing", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), body: "" }
  await writeFile(join(vault, `${note.statement}.md`), renderNote(note))

  await refreshIndexes(vault, "", "Global memory", limits)

  expect(await readIndexOf(vault, "")).toContain(
    `## Needs fixing\n\n- [[${note.statement}|${note.statement}]] · body: is empty`,
  )
})

test("indexes the other notes when one note uses an alias in its frontmatter", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createMemoryNote(vault, "", note, limits)
  await writeFile(join(vault, "Aliased.md"), noteText([...validFrontmatterLines(), "replaces: *missing"], "Body."))

  expect(await refreshIndexes(vault, "", "Global memory", limits)).toEqual({ succeeded: true })

  const index = await readIndexOf(vault, "")
  expect(index).toContain(`- [[${note.statement}|${note.statement}]] · rule`)
  expect(index).toContain("## Needs fixing\n\n- [[Aliased|Aliased]] · replaces: is an alias (*missing)")
})

test("indexes the other notes when one note has a tagged value in its frontmatter", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createMemoryNote(vault, "", note, limits)
  const repeatedKey = "extra: !!omap [ { &k same: 1 }, { *k : 2 } ]"
  await writeFile(join(vault, "Ordered.md"), noteText([...validFrontmatterLines(), repeatedKey], "Body."))

  expect(await refreshIndexes(vault, "", "Global memory", limits)).toEqual({ succeeded: true })

  const index = await readIndexOf(vault, "")
  expect(index).toContain(`- [[${note.statement}|${note.statement}]] · rule`)
  expect(index).toContain("## Needs fixing\n\n- [[Ordered|Ordered]] · extra: remove the tag !!omap")
})

test("indexes the other notes when one note has tags on its whole frontmatter and on a field name", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createMemoryNote(vault, "", note, limits)
  await writeFile(join(vault, "Tagged.md"), noteText(["!!map", ...validFrontmatterLines(), "!!str extra: 1"], "Body."))

  expect(await refreshIndexes(vault, "", "Global memory", limits)).toEqual({ succeeded: true })

  const index = await readIndexOf(vault, "")
  expect(index).toContain(`- [[${note.statement}|${note.statement}]] · rule`)
  expect(index).toContain("- [[Tagged|Tagged]] · frontmatter: remove the tag !!map")
})

test("indexes the other notes when one note has a second document in its frontmatter", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createMemoryNote(vault, "", note, limits)
  await writeFile(join(vault, "Split.md"), noteText([...validFrontmatterLines(), "...", "type: rule"], "Body."))

  expect(await refreshIndexes(vault, "", "Global memory", limits)).toEqual({ succeeded: true })

  const index = await readIndexOf(vault, "")
  expect(index).toContain(`- [[${note.statement}|${note.statement}]] · rule`)
  expect(index).toContain("- [[Split|Split]] · frontmatter: ")
})

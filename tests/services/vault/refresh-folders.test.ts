import { lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, refreshFolders, refreshIndexes } from "#/services"
import { aLimits, aNote, linkFolder, readIndexOf, tryLinkFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

function keepGoing(): boolean {
  return true
}

test("preserves an already correct index without replacing its file", async () => {
  const vault = await useTempFolder()
  const context = { path: vault, name: "Memory", limits }
  expect(await refreshIndexes(context, "")).toEqual({ succeeded: true })
  const before = await stat(join(vault, "index.md"))
  expect(await refreshIndexes(context, "")).toEqual({ succeeded: true })
  expect(await stat(join(vault, "index.md"))).toMatchObject({ mtimeMs: before.mtimeMs, ino: before.ino })
})

test("refuses an index alias to an ordinary note without replacing its bytes", async (context) => {
  const vault = await useTempFolder()
  const text = renderNote(aNote())
  await writeFile(join(vault, "Note.md"), text)
  if (!(await tryLinkFile(join(vault, "Note.md"), join(vault, "index.md")))) context.skip()
  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "")).toMatchObject({
    succeeded: false,
    reason: "invalid",
    problems: [expect.stringContaining("index.md")],
  })
  expect(await readFile(join(vault, "Note.md"), "utf8")).toBe(text)
})

test("refuses an index alias to another folder's index without writing the root content into it", async (context) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "physical"))
  const target = join(vault, "physical", "INDEX.MD")
  await writeFile(target, "old index")
  const alias = join(vault, "index.md")
  if (!(await tryLinkFile(target, alias))) context.skip()
  const named = { path: vault, name: "Memory", limits }

  expect(await refreshFolders(named, ["", "physical"], keepGoing)).toMatchObject({
    succeeded: false,
    reason: "invalid",
    problems: [expect.stringContaining("index.md")],
  })

  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readIndexOf(vault, "physical")).toBe("# physical\n")
  expect(await readFile(alias, "utf8")).not.toContain("# Memory")
})

test("does not disguise invalid filesystem arguments as maintenance I/O failures", async () => {
  const vault = await useTempFolder()

  await expect(refreshIndexes({ path: `${vault}\0`, name: "Memory", limits }, "")).rejects.toMatchObject({
    name: "TypeError",
    code: "ERR_INVALID_ARG_VALUE",
  })
  expect(await readdir(vault)).toEqual([])
})

test("reports unexpected filesystem system failures without writing indexes", async () => {
  const vault = await useTempFolder()
  const path = join(vault, "a".repeat(32768))

  await expect(realpath(path)).rejects.toMatchObject({
    code: expect.any(String),
    syscall: expect.any(String),
    errno: expect.any(Number),
  })
  expect(await refreshIndexes({ path, name: "Memory", limits }, "")).toMatchObject({
    succeeded: false,
    reason: "io-error",
    problems: [expect.stringContaining("ENAMETOOLONG")],
  })
  expect(await readdir(vault)).toEqual([])
})

test("refreshes logical and physical ancestors of a directory alias", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "physical", "subject"), { recursive: true })
  await linkFolder(join(vault, "physical", "subject"), join(vault, "alias"))
  await createMemoryNote({ path: vault, limits }, "alias", aNote())

  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "alias")).toEqual({ succeeded: true })
  expect(await readIndexOf(vault, "physical")).toContain("[[physical/subject/index|subject]]")
  expect(await readIndexOf(vault, "")).toContain("[[physical/index|physical]]")
  expect(await readIndexOf(vault, "alias")).toContain(aNote().statement)
})

async function nestedAliasVault(): Promise<string> {
  const vault = await useTempFolder()
  await mkdir(join(vault, "physical", "subject"), { recursive: true })
  await mkdir(join(vault, "other", "deep"), { recursive: true })
  await linkFolder(join(vault, "physical", "subject"), join(vault, "alias"))
  await linkFolder(join(vault, "other", "deep"), join(vault, "physical", "subject", "child"))
  await writeFile(join(vault, "other", "deep", `${aNote().statement}.md`), renderNote(aNote()))
  return vault
}

test("refreshes physical ancestors reached through every logical ancestor of nested directory aliases", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "physical", "subject"), { recursive: true })
  await mkdir(join(vault, "other", "deep"), { recursive: true })
  await linkFolder(join(vault, "physical", "subject"), join(vault, "alias"))
  await linkFolder(join(vault, "other", "deep"), join(vault, "physical", "subject", "child"))
  const note = aNote()
  await writeFile(join(vault, "other", "deep", `${note.statement}.md`), renderNote(note))
  for (const folder of ["", "physical", "physical/subject", "other", "other/deep"]) {
    await writeFile(join(vault, folder, "index.md"), `STALE INDEX ${folder}`)
  }

  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "alias/child")).toEqual({ succeeded: true })

  expect(await readIndexOf(vault, "physical")).toBe(
    "# physical\n\n## Subjects\n\n- [[physical/subject/index|subject]]\n",
  )
  expect(await readIndexOf(vault, "physical/subject")).toBe(
    "# physical/subject\n\n## Subjects\n\n- [[physical/subject/child/index|child]]\n",
  )
  expect(await readIndexOf(vault, "other")).toBe("# other\n\n## Subjects\n\n- [[other/deep/index|deep]]\n")
  expect(await readIndexOf(vault, "other/deep")).toBe(
    `# other/deep\n\n## Notes\n\n- [[other/deep/${note.statement}|${note.statement}]] · rule\n`,
  )
  expect(await readIndexOf(vault, "")).toBe(
    "# Memory\n\n## Subjects\n\n- [[alias/index|alias]]\n- [[other/index|other]]\n- [[physical/index|physical]]\n",
  )
  expect(await readIndexOf(vault, "alias")).toBe(await readIndexOf(vault, "physical/subject"))
  expect(await readIndexOf(vault, "alias/child")).toBe(await readIndexOf(vault, "other/deep"))
})

test("renders the same index for a nested alias target whether it is refreshed by add or by sync", async () => {
  const added = await nestedAliasVault()
  const synced = await nestedAliasVault()
  const physicalFolders = ["", "physical", "physical/subject", "other", "other/deep"]

  expect(await refreshIndexes({ path: added, name: "Memory", limits }, "alias/child")).toEqual({ succeeded: true })
  expect(await refreshFolders({ path: synced, name: "Memory", limits }, physicalFolders, keepGoing)).toEqual({
    succeeded: true,
  })

  for (const folder of physicalFolders) {
    expect(await readIndexOf(synced, folder)).toBe(await readIndexOf(added, folder))
  }
})

test("finishes ancestor closure through a junction back to the root without rewriting resolved indexes", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "subject"))
  await linkFolder(vault, join(vault, "subject", "back"))
  await writeFile(join(vault, "index.md"), "STALE ROOT")
  await writeFile(join(vault, "subject", "index.md"), "STALE SUBJECT")

  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "subject/back/subject/back")).toEqual({
    succeeded: true,
  })

  expect(await readIndexOf(vault, "")).toBe("# Memory\n\n## Subjects\n\n- [[subject/index|subject]]\n")
  expect(await readIndexOf(vault, "subject")).toBe("# subject\n\n## Subjects\n\n- [[subject/back/index|back]]\n")
  expect(await readIndexOf(vault, "subject/back")).toBe(await readIndexOf(vault, ""))
})

test("renders problematic folders and whitespace-only note names in the final index", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "escape"))
  await writeFile(join(vault, " .md"), "No frontmatter")
  await writeFile(join(vault, ".md"), renderNote(aNote()))

  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "")).toEqual({ succeeded: true })
  const index = await readIndexOf(vault, "")
  expect(index).toContain("Folder `escape`")
  expect(index).toContain("outside the vault")
  expect(index).toContain("- ` ` · missing frontmatter")
  expect(index).toContain("- <code></code> · statement: is empty")
})

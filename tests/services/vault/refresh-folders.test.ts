import { lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { refreshFolders, refreshIndexes } from "#src/services"
import { aLimits, aNote, keepGoing, linkFolder, readIndexOf, tryLinkFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

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

  expect(await refreshFolders(named, ["", "physical"], keepGoing, "with-ancestors")).toMatchObject({
    succeeded: false,
    reason: "invalid",
    problems: [expect.stringContaining("index.md")],
  })

  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readIndexOf(vault, "physical")).toBe("# physical\n")
  expect(await readFile(alias, "utf8")).not.toContain("# Memory")
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

import { mkdir, readdir, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, refreshIndexes } from "#/services"
import { aLimits, aNote, linkFolder, readIndexOf, useTempFolder } from "#test-helpers"

const limits = aLimits()

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

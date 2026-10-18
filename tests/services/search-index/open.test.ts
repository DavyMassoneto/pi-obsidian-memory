import { lstat, readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { openIndex, putNote, recoverIndex, searchText } from "#src/services"
import { anEntry, changeIndexFile, openedIndex, statementsOf, tryLinkFile, useTempFolder } from "#test-helpers"

test.for(["", "-journal", "-wal", "-shm"])(
  "refuses database or sidecar link %s before opening",
  async (suffix, context) => {
    const root = await useTempFolder()
    const target = join(root, "target.sqlite")
    openedIndex(target).close()
    const path = join(root, "catalog.sqlite")
    if (suffix !== "") openedIndex(path).close()
    if (!(await tryLinkFile(target, `${path}${suffix}`))) context.skip("this system cannot create file links")
    const before = await readFile(target)
    const opened = recoverIndex({ path })
    if (opened.succeeded) opened.output.close()
    expect(opened).toMatchObject({ succeeded: false, reason: "unavailable" })
    expect((await lstat(`${path}${suffix}`)).isSymbolicLink()).toBe(true)
    expect(await readFile(target)).toEqual(before)
  },
)

test("refuses a dangling database link without replacing it", async (context) => {
  const root = await useTempFolder()
  const path = join(root, "catalog.sqlite")
  const target = join(root, "missing.sqlite")
  if (!(await tryLinkFile(target, path))) context.skip("this system cannot create file links")
  const result = recoverIndex({ path })
  if (result.succeeded) result.output.close()
  expect(result).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect((await lstat(path)).isSymbolicLink()).toBe(true)
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" })
})

test("creates the index file and its folders, reporting that it needs population", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "index", "vault.sqlite")
  const result = openIndex(path)
  expect(result).toMatchObject({ succeeded: true, rebuilt: true })
  if (!result.succeeded) throw new Error("open failed")
  expect(result.output.close()).toEqual({ succeeded: true })
  expect((await stat(path)).isFile()).toBe(true)
})

test("keeps the notes after the index is closed and opened again", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  const first = openedIndex(path)
  expect(putNote(first, anEntry())).toEqual({ succeeded: true })
  first.close()

  const again = openIndex(path)
  expect(again).toMatchObject({ succeeded: true, rebuilt: false })
  if (!again.succeeded) throw new Error("reopen failed")
  const hits = searchText(again.output, "pnpm", { includeArchived: false })
  again.output.close()

  expect(statementsOf(hits)).toEqual([anEntry().statement])
})

test("refuses FTS content divergence without replacing the database and releases its transaction", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  const index = openedIndex(path)
  expect(putNote(index, anEntry())).toEqual({ succeeded: true })
  index.close()
  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts) VALUES ('delete-all')")
  const before = await readFile(path)

  const result = openIndex(path)
  if (result.succeeded) result.output.close()
  expect(result).toMatchObject({ succeeded: false, reason: "corrupted" })
  expect(await readFile(path)).toEqual(before)

  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts) VALUES ('rebuild')")
  const repaired = openedIndex(path)
  expect(statementsOf(searchText(repaired, "pnpm", { includeArchived: false }))).toEqual([anEntry().statement])
})

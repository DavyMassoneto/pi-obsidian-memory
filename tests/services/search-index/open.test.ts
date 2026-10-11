import { readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { indexFileFor, openIndex, putNote, searchText } from "#/services"
import { anEntry, changeIndexFile, openedIndex, statementsOf, useTempFolder } from "#test-helpers"

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
  const hits = searchText(again.output, "pnpm", { limit: 10, includeArchived: false })
  again.output.close()

  expect(statementsOf(hits)).toEqual([anEntry().statement])
})

test("reports a corrupt database without replacing it or leaking its connection", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  await writeFile(path, "not a SQLite database")

  expect(openIndex(path)).toMatchObject({ succeeded: false, reason: "corrupted", problems: [expect.any(String)] })
  expect(await readFile(path, "utf8")).toBe("not a SQLite database")
  await rm(path)
  const fresh = openedIndex(path)
  expect(putNote(fresh, anEntry())).toEqual({ succeeded: true })
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
  expect(statementsOf(searchText(repaired, "pnpm", { limit: 10, includeArchived: false }))).toEqual([
    anEntry().statement,
  ])
})

test("reports inaccessible index paths as unavailable", async () => {
  const file = join(await useTempFolder(), "file")
  await writeFile(file, "occupied")

  expect(openIndex(join(file, "vault.sqlite"))).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(await readFile(file, "utf8")).toBe("occupied")
})

test("closes a connection when the FTS table is missing", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  openedIndex(path).close()
  changeIndexFile(path, "DROP TABLE notes_fts")

  expect(openIndex(path)).toMatchObject({ succeeded: false, reason: "corrupted" })
  await rm(path)
  expect(putNote(openedIndex(path), anEntry())).toEqual({ succeeded: true })
})

test("gives the same vault the same index file, however its path is written", () => {
  const folder = join("C:", "agent", "index")

  expect(indexFileFor(folder, "C:/Vaults/Global memory")).toBe(indexFileFor(folder, "c:\\vaults\\GLOBAL MEMORY\\"))
})

test("gives different vaults different index files", () => {
  const folder = join("C:", "agent", "index")

  expect(indexFileFor(folder, "C:/Vaults/loja")).not.toBe(indexFileFor(folder, "C:/Vaults/loja-admin"))
  expect(indexFileFor(folder, "C:/Vaults/loja")).toMatch(/[\\/]index[\\/][0-9a-f]{16}\.sqlite$/)
})

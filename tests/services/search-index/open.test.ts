import { stat } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { indexFileFor, openIndex, putNote, searchText } from "#/services"
import { anEntry, useTempFolder } from "#test-helpers"

test("creates the index file and its folders", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "index", "vault.sqlite")

  openIndex(path).close()

  expect((await stat(path)).isFile()).toBe(true)
})

test("keeps the notes after the index is closed and opened again", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "vault.sqlite")
  const first = openIndex(path)
  putNote(first, anEntry())
  first.close()

  const again = openIndex(path)
  const hits = searchText(again, "pnpm", { limit: 10, includeArchived: false })
  again.close()

  expect(hits.map((hit) => hit.id)).toEqual([anEntry().id])
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

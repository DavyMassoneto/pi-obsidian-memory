import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { refreshLoaded } from "#src/usecases"
import { loadedFixture, noteWithId, putCatalogFile } from "#test-helpers"

test("a note that did not change gives nothing", async () => {
  const { loaded, context } = await loadedFixture()

  expect((await refreshLoaded(loaded, context)).blocks).toEqual([])
})

test("an edit made in Obsidian gives a block that replaces the earlier copy, once", async () => {
  const { loaded, context, vault, path } = await loadedFixture()
  await putCatalogFile(vault, path, noteWithId(1, "pnpm, and corepack too.", []))

  const { blocks, changes } = await refreshLoaded(loaded, context)

  expect(blocks).toHaveLength(1)
  expect(changes.loaded.map((note) => note.path)).toEqual([path])
  expect(changes.forgotten).toEqual([])
  expect(blocks[0]).toContain('replaces the earlier copy of "global · tools/Use pnpm.md"')
  expect(blocks[0]).toContain("corepack")
  expect((await refreshLoaded(loaded, context)).blocks).toEqual([])
})

test("a note that was deleted is marked no longer valid, once", async () => {
  const { loaded, context, vault, path } = await loadedFixture()
  await rm(join(vault.path, path))

  const { blocks, changes } = await refreshLoaded(loaded, context)

  expect(blocks).toHaveLength(1)
  expect(changes.forgotten.map((note) => note.path)).toEqual([path])
  expect(blocks[0]).toContain("no longer valid")
  expect(loaded.all()).toEqual([])
})

test("nothing is judged once the operation was cancelled", async () => {
  const { loaded, context, vault, path, controller } = await loadedFixture()
  await rm(join(vault.path, path))
  controller.abort()

  expect((await refreshLoaded(loaded, context)).blocks).toEqual([])
  expect(loaded.all()).toHaveLength(1)
})

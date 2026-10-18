import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { INVALID_UNUSABLE } from "#src/domain"
import { refreshLoaded } from "#src/usecases"
import { loadedFixture, noteWithId, putCatalogFile, writeRegistrationSnapshot } from "#test-helpers"

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
  expect(blocks[0]).toBe(
    'The earlier copy of "global · tools/Use pnpm.md" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.',
  )
  expect(loaded.all()).toEqual([])
})

test("a note that is still there with no body is marked no longer valid with its problem, once", async () => {
  const { loaded, context, vault, path } = await loadedFixture()
  await putCatalogFile(vault, path, noteWithId(1, "", []))

  const { blocks, changes } = await refreshLoaded(loaded, context)

  expect(changes.forgotten.map((note) => note.path)).toEqual([path])
  expect(blocks).toEqual([
    'The earlier copy of "global · tools/Use pnpm.md" loaded above is no longer valid: the note is still there but cannot be used (tools/Use pnpm.md has no body). Do not rely on it.',
  ])
  expect(loaded.all()).toEqual([])
})

test("a note whose parent folder became a file is marked archived or deleted", async () => {
  const { loaded, context, vault } = await loadedFixture()
  await rm(join(vault.path, "tools"), { recursive: true })
  await putCatalogFile(vault, "tools", "not a folder")

  expect((await refreshLoaded(loaded, context)).blocks).toEqual([
    'The earlier copy of "global \u00b7 tools/Use pnpm.md" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.',
  ])
})

test("a note rewritten with unclosed frontmatter is marked still there but unusable", async () => {
  const { loaded, context, vault, path } = await loadedFixture()
  await putCatalogFile(vault, path, "---\ntype: rule\nnot closed")

  const { blocks } = await refreshLoaded(loaded, context)

  expect(blocks).toEqual([
    `The earlier copy of "global \u00b7 tools/Use pnpm.md" loaded above is no longer valid: ${INVALID_UNUSABLE} (frontmatter is not closed). Do not rely on it.`,
  ])
})

test("a note that cannot be read because the config is invalid is marked unreadable, not still there", async () => {
  const { loaded, context, config } = await loadedFixture()
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, extra: true }))
  await refreshLoaded(loaded, context)
  context.stamp = context.session.stamp()

  const { blocks, changes } = await refreshLoaded(loaded, context)

  expect(changes.forgotten.map((note) => note.path)).toEqual(["tools/Use pnpm.md"])
  expect(blocks).toEqual([
    'The earlier copy of "global \u00b7 tools/Use pnpm.md" loaded above is no longer valid: the note cannot be read (extra: not a known field). Do not rely on it.',
  ])
})

test("nothing is judged once the operation was cancelled", async () => {
  const { loaded, context, vault, path, controller } = await loadedFixture()
  await rm(join(vault.path, path))
  controller.abort()

  expect((await refreshLoaded(loaded, context)).blocks).toEqual([])
  expect(loaded.all()).toHaveLength(1)
})

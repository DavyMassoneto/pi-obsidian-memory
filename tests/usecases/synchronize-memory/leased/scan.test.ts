import { mkdir, readFile, rm, utimes } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#/usecases"
import {
  linkFolder,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("stat reuse deliberately does not detect same-size same-mtime external edits", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory first"))
  await utimes(join(vault.path, "Note.md"), new Date(10000), new Date(10000))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = synchronizedCatalog(path).inventory
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory other"))
  await utimes(join(vault.path, "Note.md"), new Date(10000), new Date(10000))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { committed: false },
  })
  expect(synchronizedCatalog(path).inventory).toEqual(before)
  expect(await readFile(join(vault.path, "Note.md"), "utf8")).toContain("memory other")
})

test("date-only, header-only and semantic changes persist distinct stat/raw/content fingerprints", async () => {
  const { vault, context } = await memoryReadFixture()
  const text = noteText(validFrontmatterLines(), "memory content")
  await putCatalogFile(vault, "Note.md", text)
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const first = synchronizedCatalog(path).inventory.entries[0]
  await utimes(join(vault.path, "Note.md"), new Date(10000), new Date(10000))
  await synchronizeMemory({ vault: "global" }, context)
  const dated = synchronizedCatalog(path).inventory.entries[0]
  expect(dated).toEqual({ ...first, stat: { ...first?.stat, mtimeMs: 10000 } })
  await putCatalogFile(vault, "Note.md", text.replace("updated: 2026-10-04", "updated: 2026-10-05"))
  await synchronizeMemory({ vault: "global" }, context)
  const header = synchronizedCatalog(path).inventory.entries[0]
  expect(header?.contentFingerprint).toBe(first?.contentFingerprint)
  expect(header?.rawHash).not.toBe(first?.rawHash)
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory changed"))
  await synchronizeMemory({ vault: "global" }, context)
  expect(synchronizedCatalog(path).inventory.entries[0]?.contentFingerprint).not.toBe(first?.contentFingerprint)
})

test("changed limits require fresh authority and revalidate unchanged bytes", async () => {
  const { vault, config, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory content"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const first = synchronizedCatalog(path).inventory.entries[0]
  config.limits.maxBodyChars = 3
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "stale-session",
  })
  context.stamp = context.session.stamp()
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { population: "ready" },
  })
  const next = synchronizedCatalog(path).inventory.entries[0]
  expect(next).toMatchObject({
    rawHash: first?.rawHash,
    contentFingerprint: first?.contentFingerprint,
    needsFixing: true,
  })
  expect(next?.validationFingerprint).not.toBe(first?.validationFingerprint)
  expect(synchronizedCatalog(path).hits).toHaveLength(1)
})

test("failed subtrees retain old rows; incomplete rebuild never becomes ready", async () => {
  const { vault, root, context } = await memoryReadFixture()
  await putCatalogFile(vault, "topic/Note.md", noteText(validFrontmatterLines(), "memory retained"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = synchronizedCatalog(path).inventory
  await rm(join(vault.path, "topic"), { recursive: true })
  await linkFolder(join(root, "missing"), join(vault.path, "topic"))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { population: "ready", coverage: "degraded" },
  })
  expect(synchronizedCatalog(path).inventory).toEqual(before)
  await rm(path)
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { population: "needs-population", coverage: "degraded" },
  })
  expect(synchronizedCatalog(path).inventory).toMatchObject({ population: "needs-population", entries: [] })
})

test("physical aliases do not cause duplicate recursive traversal or overwrite note bytes", async () => {
  const { vault, context } = await memoryReadFixture()
  const text = noteText(validFrontmatterLines(), "memory aliased")
  await putCatalogFile(vault, "physical/Note.md", text)
  await linkFolder(join(vault.path, "physical"), join(vault.path, "alias"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  expect(synchronizedCatalog(path).inventory.entries.map((entry) => entry.path)).toEqual(["physical/Note.md"])
  expect(await readFile(join(vault.path, "physical/Note.md"), "utf8")).toBe(text)
  expect(await readFile(join(vault.path, "alias/index.md"), "utf8")).toContain("Note")
})

test("a directory replaced by an alias to a hidden folder retires its cached rows without degrading coverage", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "tools/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "Other.md", noteText(validFrontmatterLines(), "memory other"))
  await synchronizeMemory({ vault: "global" }, context)
  await mkdir(join(vault.path, ".stash"))
  await rm(join(vault.path, "tools"), { recursive: true })
  await putCatalogFile(vault, ".stash/tools/Note.md", noteText(validFrontmatterLines(), "memory"))
  await linkFolder(join(vault.path, ".stash/tools"), join(vault.path, "tools"))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { committed: true, coverage: "complete", warnings: [] },
  })
  const { inventory } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.map((entry) => entry.path)).toEqual(["Other.md"])
})

test("a directory replaced by an alias to the vault root retires its cached rows without degrading coverage", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "topic/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "Other.md", noteText(validFrontmatterLines(), "memory other"))
  await synchronizeMemory({ vault: "global" }, context)
  await rm(join(vault.path, "topic"), { recursive: true })
  await linkFolder(vault.path, join(vault.path, "topic"))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { committed: true, coverage: "complete", warnings: [] },
  })
  const { inventory } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.map((entry) => entry.path)).toEqual(["Other.md"])
})

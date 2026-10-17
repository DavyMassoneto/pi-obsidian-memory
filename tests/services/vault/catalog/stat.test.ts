import { rename, stat, utimes } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectVaultFile, sameCatalogStat } from "#src/services"
import { catalogVault, noteText, putCatalogFile, statOfFile, validFrontmatterLines } from "#test-helpers"

test("timestamp-only edits retain the exact hash and limits are rechecked independently of bytes", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", noteText(validFrontmatterLines(), "longer body"))
  const first = await inspectVaultFile(vault, { path: "a.md" })
  expect(first.succeeded).toBe(true)
  if (!first.succeeded) return
  const file = join(vault.path, "a.md")
  await utimes(file, new Date("2026-01-01"), new Date("2026-01-01"))
  vault.limits.maxBodyChars = 1
  const second = await inspectVaultFile(vault, { path: "a.md" })
  expect(second.succeeded).toBe(true)
  if (!second.succeeded) return
  const disk = await stat(file)
  expect(second.output.rawHash).toBe(first.output.rawHash)
  expect(second.output.stat).toEqual({
    size: disk.size,
    mtimeMs: disk.mtimeMs,
    ctimeMs: disk.ctimeMs,
    device: disk.dev,
    inode: disk.ino,
  })
  expect(second.output.analysis).toMatchObject({ searchable: true, needsFixing: true })
})

test("stats that differ only in ctimeMs are the same snapshot", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "text")
  const real = await statOfFile(join(vault.path, "a.md"))

  expect(sameCatalogStat(real, { ...real, ctimeMs: real.ctimeMs + 60_000 })).toBe(true)
})

test("a different size, mtimeMs, device or inode is a changed snapshot", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "text")
  await putCatalogFile(vault, "b.md", "text")
  const real = await statOfFile(join(vault.path, "a.md"))
  const other = await statOfFile(join(vault.path, "b.md"))

  expect(sameCatalogStat(real, { ...real, size: real.size + 1 })).toBe(false)
  expect(sameCatalogStat(real, { ...real, mtimeMs: real.mtimeMs + 1 })).toBe(false)
  expect(sameCatalogStat(real, { ...real, device: real.device + 1 })).toBe(false)
  expect(sameCatalogStat(real, { ...real, inode: other.inode })).toBe(false)
})

test("a file replaced by temp file and rename is a changed snapshot", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "text")
  const before = await statOfFile(join(vault.path, "a.md"))
  await putCatalogFile(vault, "a.md.tmp", "text")
  await rename(join(vault.path, "a.md.tmp"), join(vault.path, "a.md"))
  await utimes(join(vault.path, "a.md"), before.mtimeMs / 1000, before.mtimeMs / 1000)

  expect(sameCatalogStat(before, await statOfFile(join(vault.path, "a.md")))).toBe(false)
})

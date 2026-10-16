import { stat, utimes } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectVaultFile } from "#src/services"
import { catalogVault, noteText, putCatalogFile, validFrontmatterLines } from "#test-helpers"

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

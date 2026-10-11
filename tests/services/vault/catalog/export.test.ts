import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { collectExportFiles } from "#/services"
import { catalogVault, linkFolder, putCatalogFile, useTempFolder } from "#test-helpers"

test("export collects exact visible bytes including attachments, archive, templates and dashboard", async () => {
  const vault = await catalogVault()
  const included = ["a.md", "index.md", "archive/a.md", "_templates/rule.md", "Memory.base", "attachments/image.png"]
  const excluded = [
    ".obsidian/config.json",
    "folder/.hidden/file.md",
    ".secret",
    ".Memory.base.tmp-stale",
    ".Memory.base.tmp-directory/nested.md",
    ".a.md.tmp-123",
    "folder/a.md.tmp-123",
    "discard.md.tmp-123/nested.md",
  ]
  for (const path of [...included, ...excluded]) await putCatalogFile(vault, path, new Uint8Array([0, 255, 10]))
  const result = await collectExportFiles(vault)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) return
  expect(result.output.map((file) => file.path).sort()).toEqual(included.sort())
  for (const file of result.output) {
    expect([...file.bytes]).toEqual([0, 255, 10])
    expect(file.rawHash).toMatch(/^[a-f0-9]{64}$/)
  }
  for (const path of [...included, ...excluded]) {
    expect([...(await readFile(join(vault.path, path)))]).toEqual([0, 255, 10])
  }
})

test("export refuses an incomplete snapshot rather than silently omitting unsafe files", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "kept")
  await linkFolder(await useTempFolder(), join(vault.path, "outside"))
  const result = await collectExportFiles(vault)
  expect(result).toMatchObject({
    succeeded: false,
    failures: [expect.objectContaining({ path: "outside", reason: "outside-vault" })],
  })
})

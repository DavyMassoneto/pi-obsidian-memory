import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { observeVaultPath } from "#/services"
import { catalogVault, linkFolder, memoryReadTree, putCatalogFile } from "#test-helpers"

test("observes real path kind without extension guessing or file slash coercion", async () => {
  const vault = await catalogVault()
  await mkdir(join(vault.path, "folder.md"))
  await putCatalogFile(vault, "file", "ordinary file")
  const before = await memoryReadTree(vault.path)
  for (const path of ["", "folder.md", "folder.md/"]) {
    expect(await observeVaultPath(vault, { path })).toMatchObject({ succeeded: true, output: { kind: "directory" } })
  }
  expect(await observeVaultPath(vault, { path: "file" })).toMatchObject({ succeeded: true, output: { kind: "file" } })
  expect(await observeVaultPath(vault, { path: "file/" })).toMatchObject({ succeeded: false, reason: "not-directory" })
  expect(await observeVaultPath(vault, { path: "missing" })).toMatchObject({ succeeded: false, reason: "not-found" })
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("rejects unsafe paths, escaped aliases and reserved folder targets", async () => {
  const vault = await catalogVault()
  const outside = await catalogVault()
  await mkdir(join(vault.path, ".hidden"))
  await mkdir(join(vault.path, "_templates"))
  await linkFolder(join(vault.path, "_templates"), join(vault.path, "alias"))
  await linkFolder(outside.path, join(vault.path, "escape"))
  for (const path of ["/", "../escape", "folder//", "./folder", "C:/folder", "folder\\child"]) {
    expect(await observeVaultPath(vault, { path })).toMatchObject({ succeeded: false, reason: "invalid-path" })
  }
  for (const path of [".hidden", "_templates", "alias"]) {
    expect(await observeVaultPath(vault, { path })).toMatchObject({ succeeded: false, reason: "excluded" })
  }
  expect(await observeVaultPath(vault, { path: "escape" })).toMatchObject({ succeeded: false, reason: "outside-vault" })
})

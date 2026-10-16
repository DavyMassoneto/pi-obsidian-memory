import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectVaultFile } from "#src/services"
import { catalogVault, linkFolder, putCatalogFile } from "#test-helpers"

test("rejects traversal, drive, alternate-stream and backslash paths before reading", async () => {
  const vault = await catalogVault()
  for (const path of ["../a.md", "/a.md", "C:/a.md", "a//b.md", "a/./b.md", "a.md:stream", "a\\b.md"]) {
    expect(await inspectVaultFile(vault, { path })).toMatchObject({ succeeded: false, reason: "invalid-path" })
  }
})

test("checks every link component even when an outside directory links back inside", async () => {
  const vault = await catalogVault()
  const outside = await catalogVault()
  await putCatalogFile(vault, "subject/a.md", "sensitive")
  await linkFolder(join(vault.path, "subject"), join(outside.path, "back"))
  await linkFolder(outside.path, join(vault.path, "escape"))
  expect(await inspectVaultFile(vault, { path: "escape/back/a.md" })).toMatchObject({
    succeeded: false,
    reason: "outside-vault",
  })
})

import { join } from "node:path"

import { expect, test } from "vitest"

import { enumerateVault } from "#/services"
import { catalogVault, linkFolder, putCatalogFile } from "#test-helpers"

test("does not traverse root template aliases as memory or follow hidden-directory aliases", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "_templates/rule.md", "not memory")
  await putCatalogFile(vault, ".hidden/a.md", "not memory")
  await linkFolder(join(vault.path, "_templates"), join(vault.path, "alias"))
  await linkFolder(join(vault.path, ".hidden"), join(vault.path, "hidden-alias"))
  const result = await enumerateVault(vault)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) return
  expect(result.output.entries.filter((entry) => entry.kind === "note")).toEqual([])
  expect(result.output.aliases).toEqual([{ path: "alias", target: "_templates" }])
  expect(result.output.failures).toEqual([expect.objectContaining({ path: "hidden-alias", reason: "excluded" })])
})

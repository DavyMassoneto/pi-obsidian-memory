import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { ensureVaultAssets } from "#/services"
import { catalogVault } from "#test-helpers"

test("concurrent explicit bootstraps never clobber or duplicate assets", async () => {
  const vault = { ...(await catalogVault()), name: "Vault" }
  const results = await Promise.all([ensureVaultAssets(vault), ensureVaultAssets(vault)])
  expect(results.every((result) => result.succeeded)).toBe(true)
  expect(await readdir(join(vault.path, "_templates"))).toHaveLength(12)
  expect(await readFile(join(vault.path, "_templates/rule.md"), "utf8")).toContain("REPLACE_WITH_NEW_ULID")
  expect(await readFile(join(vault.path, "Memory.base"), "utf8")).toContain("Don't forget")
})

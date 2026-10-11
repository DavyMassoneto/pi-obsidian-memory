import { mkdir, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { ensureVaultAssets } from "#/services"
import { catalogVault, putCatalogFile } from "#test-helpers"

test("attaches to case-insensitive existing template folder and dashboard without rewriting bytes", async () => {
  const vault = { ...(await catalogVault()), name: "Vault" }
  await mkdir(join(vault.path, "_Templates"))
  await putCatalogFile(vault, "_Templates/RULE.md", "custom rule")
  await putCatalogFile(vault, "MEMORY.BASE", "custom dashboard")
  const result = await ensureVaultAssets(vault)
  expect(result).toMatchObject({ succeeded: true, output: { createdRoot: false } })
  expect(await readdir(vault.path)).toEqual(["MEMORY.BASE", "_Templates"])
  expect(await readFile(join(vault.path, "_Templates/RULE.md"), "utf8")).toBe("custom rule")
  expect(await readFile(join(vault.path, "MEMORY.BASE"), "utf8")).toBe("custom dashboard")
  expect(await readdir(join(vault.path, "_Templates"))).toHaveLength(12)
})

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readCatalogBytes } from "#/services"
import { catalogVault, putCatalogFile } from "#test-helpers"

test("a scan fingerprint refuses a subsequent edit without changing the file", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "first")
  const first = await readCatalogBytes(vault, { path: "a.md" })
  expect(first.succeeded).toBe(true)
  if (!first.succeeded) return
  await putCatalogFile(vault, "a.md", "edited")
  expect(await readCatalogBytes(vault, { path: "a.md", expectedStat: first.output.stat })).toMatchObject({
    succeeded: false,
    path: "a.md",
    reason: "changed",
  })
  expect(await readFile(join(vault.path, "a.md"), "utf8")).toBe("edited")
})

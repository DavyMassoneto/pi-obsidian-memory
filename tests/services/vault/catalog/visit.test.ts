import { readFile, symlink } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { enumerateVault, inspectVaultFile } from "#src/services"
import { catalogVault, linkFolder, noteText, putCatalogFile, validFrontmatterLines } from "#test-helpers"

test("dot file aliases retain canonical identity but never admit a hidden directory", async () => {
  const vault = await catalogVault()
  const text = noteText(validFrontmatterLines(), "kept")
  await putCatalogFile(vault, "subject/.Rule.md", text)
  await putCatalogFile(vault, ".hidden/Rule.md", text)
  await symlink(join(vault.path, "subject/.Rule.md"), join(vault.path, "Alias.md"), "file")
  await symlink(join(vault.path, ".hidden/Rule.md"), join(vault.path, "Hidden.md"), "file")
  await linkFolder(join(vault.path, "subject"), join(vault.path, ".Directory.md"))
  await linkFolder(join(vault.path, ".hidden"), join(vault.path, "hidden-alias"))

  const scan = await enumerateVault(vault)
  if (!scan.succeeded) throw new Error("Expected enumeration")
  expect(scan.output.entries.filter((entry) => entry.kind === "note").map((entry) => entry.path)).toEqual([
    "subject/.Rule.md",
  ])
  expect(scan.output.aliases).toEqual([{ path: "Alias.md", target: "subject/.Rule.md" }])
  expect(scan.output.completeDirectories.sort()).toEqual(["", "subject"])
  expect(
    scan.output.failures.map(({ path, reason }) => ({ path, reason })).sort((a, b) => a.path.localeCompare(b.path)),
  ).toEqual([
    { path: "hidden-alias", reason: "excluded" },
    { path: "Hidden.md", reason: "excluded" },
  ])
  expect(await inspectVaultFile(vault, { path: "Alias.md" })).toMatchObject({
    succeeded: true,
    output: { canonicalPath: "subject/.Rule.md", analysis: { searchable: true } },
  })
  for (const path of ["Hidden.md", "hidden-alias/Rule.md", ".Directory.md/.Rule.md"]) {
    expect(await inspectVaultFile(vault, { path })).toMatchObject({ succeeded: false, reason: "excluded" })
  }
  expect(await readFile(join(vault.path, "subject/.Rule.md"), "utf8")).toBe(text)
})

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

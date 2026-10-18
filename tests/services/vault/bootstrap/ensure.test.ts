import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, it, test } from "vitest"

import { ensureVaultAssets } from "#src/services"
import { catalogVault, linkFolder, useTempFolder } from "#test-helpers"

test("explicit bootstrap creates twelve templates and dashboard, preserving existing assets", async () => {
  const parent = await catalogVault()
  const vault = { ...parent, path: join(parent.path, "new"), name: "My vault" }
  const first = await ensureVaultAssets(vault)
  expect(first.succeeded).toBe(true)
  expect(await readdir(join(vault.path, "_templates"))).toHaveLength(12)
  const template = await readFile(join(vault.path, "_templates/rule.md"), "utf8")
  expect(template).toContain("id: REPLACE_WITH_NEW_ULID")
  expect(template).toContain('created: "{{date:YYYY-MM-DD}}"')
  await writeFile(join(vault.path, "_templates/rule.md"), "my template\r\n")
  await writeFile(join(vault.path, "Memory.base"), "my dashboard\r\n")
  expect(await ensureVaultAssets(vault)).toMatchObject({ succeeded: true, output: { created: [] } })
  expect(await readFile(join(vault.path, "_templates/rule.md"), "utf8")).toBe("my template\r\n")
  expect(await readFile(join(vault.path, "Memory.base"), "utf8")).toBe("my dashboard\r\n")
})

it.skipIf(process.platform === "linux")(
  "explicit bootstrap finds an existing template whose name differs only in case",
  async () => {
    const parent = await catalogVault()
    const vault = { ...parent, path: join(parent.path, "new"), name: "My vault" }
    expect((await ensureVaultAssets(vault)).succeeded).toBe(true)
    await writeFile(join(vault.path, "_templates/rule.md"), "my template\r\n")
    expect(await ensureVaultAssets(vault)).toMatchObject({ succeeded: true, output: { created: [] } })
    expect(await readFile(join(vault.path, "_templates/RULE.md"), "utf8")).toBe("my template\r\n")
  },
)

test("asset failures report partial creation and never follow escaping template links", async () => {
  const vault = { ...(await catalogVault()), name: "Vault" }
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault.path, "_templates"))
  expect(await ensureVaultAssets(vault)).toMatchObject({
    succeeded: false,
    created: [],
    failure: { reason: "outside-vault" },
  })
  expect(await readdir(outside)).toEqual([])
  const blocked = { ...(await catalogVault()), name: "Blocked" }
  await mkdir(join(blocked.path, "Memory.base"))
  const result = await ensureVaultAssets(blocked)
  expect(result).toMatchObject({ succeeded: false, failure: { reason: "not-file" } })
})

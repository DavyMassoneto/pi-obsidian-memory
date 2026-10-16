import { expect, test } from "vitest"

import { catalogIoFailure, enumerateVault, inspectVaultFile } from "#/services"
import { catalogVault, putCatalogFile } from "#test-helpers"

test("reports missing files and non-directory traversal distinctly", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "a.md", "body")
  expect(await inspectVaultFile(vault, { path: "absent.md" })).toMatchObject({
    succeeded: false,
    path: "absent.md",
    reason: "not-found",
  })
  expect(await inspectVaultFile(vault, { path: "a.md/child.md" })).toMatchObject({ succeeded: false })
  expect(await enumerateVault({ ...vault, path: `${vault.path}/a.md` })).toMatchObject({
    succeeded: false,
    reason: "not-directory",
    scope: "directory",
  })
})

test("labels a plain ELOOP I/O error as an ordinary failure, not as a directory-alias cycle", () => {
  const error = Object.assign(new Error("ELOOP: too many symbolic links encountered"), { code: "ELOOP" })

  expect(catalogIoFailure(error, { path: "a.md", scope: "file" })).toMatchObject({
    succeeded: false,
    path: "a.md",
    reason: "io-error",
  })
})

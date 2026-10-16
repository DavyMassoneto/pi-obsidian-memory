import { mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readFolderIndex } from "#src/services"
import { catalogVault, linkFolder, memoryReadTree, putCatalogFile, tryLinkFile } from "#test-helpers"

test("reads exact case-preserved index text and bytes without generating assets", async () => {
  const vault = await catalogVault()
  const text = "# Edited\r\n\r\nDo not regenerate.  \r\n"
  await putCatalogFile(vault, "subject/INDEX.MD", text)
  const before = await memoryReadTree(vault.path)
  for (const folder of ["subject", "subject/"]) {
    expect(await readFolderIndex(vault, { folder })).toMatchObject({
      succeeded: true,
      output: { path: "subject/INDEX.MD", text, bytes: Buffer.from(text), canonicalPath: "subject/INDEX.MD" },
    })
  }
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("missing indexes, missing folders and non-directories are refusals, never repairs", async () => {
  const vault = await catalogVault()
  await mkdir(join(vault.path, "empty"))
  await putCatalogFile(vault, "file.md", "file")
  const before = await memoryReadTree(vault.path)
  expect(await readFolderIndex(vault, { folder: "empty" })).toMatchObject({ succeeded: false, reason: "not-found" })
  expect(await readFolderIndex(vault, { folder: "missing" })).toMatchObject({ succeeded: false, reason: "not-found" })
  expect(await readFolderIndex(vault, { folder: "file.md" })).toMatchObject({
    succeeded: false,
    reason: "not-directory",
  })
  expect(await memoryReadTree(vault.path)).toEqual(before)
})

test("folder containment permits archives and internal aliases, excludes hidden and template roots", async () => {
  const vault = await catalogVault()
  for (const folder of ["archive", "_templates", ".hidden", "topic/_templates"]) {
    await putCatalogFile(vault, `${folder}/Index.md`, folder)
  }
  await linkFolder(join(vault.path, "archive"), join(vault.path, "old"))
  await linkFolder(join(vault.path, "_templates"), join(vault.path, "templates"))
  await linkFolder(join(vault.path, ".hidden"), join(vault.path, "hidden"))
  for (const folder of ["archive", "old", "topic/_templates"]) {
    expect(await readFolderIndex(vault, { folder })).toMatchObject({ succeeded: true })
  }
  for (const folder of ["_templates", "templates", ".hidden", "hidden"]) {
    expect(await readFolderIndex(vault, { folder })).toMatchObject({ succeeded: false, reason: "excluded" })
  }
  expect(await readFolderIndex(vault, { folder: "../escape" })).toMatchObject({
    succeeded: false,
    reason: "invalid-path",
  })
})

test("rejects escaping and broken folder links and escaping index file links", async (context) => {
  const vault = await catalogVault()
  const outside = await catalogVault()
  await putCatalogFile(outside, "index.md", "outside")
  await linkFolder(outside.path, join(vault.path, "outside"))
  await linkFolder(join(outside.path, "missing"), join(vault.path, "broken"))
  expect(await readFolderIndex(vault, { folder: "outside" })).toMatchObject({
    succeeded: false,
    reason: "outside-vault",
  })
  expect(await readFolderIndex(vault, { folder: "broken" })).toMatchObject({ succeeded: false, reason: "not-found" })
  if (!(await tryLinkFile(join(outside.path, "index.md"), join(vault.path, "index.md")))) context.skip()
  expect(await readFolderIndex(vault, { folder: "" })).toMatchObject({ succeeded: false, reason: "outside-vault" })
})

test("rejects ambiguous case-variant indexes on filesystems that permit both", async (context) => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "index.md", "one")
  await putCatalogFile(vault, "INDEX.MD", "two")
  if ((await readdir(vault.path)).length !== 2) context.skip()
  expect(await readFolderIndex(vault, { folder: "" })).toMatchObject({ succeeded: false, reason: "ambiguous-index" })
})

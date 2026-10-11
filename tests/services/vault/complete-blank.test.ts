import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { completeBlankFile, inspectVaultFile } from "#/services"
import { aNote, catalogVault, linkFolder, putCatalogFile } from "#test-helpers"

test("confirmed blank completion uses the supplied valid identity and preserves unrelated files", async () => {
  const vault = await catalogVault()
  const note = aNote()
  const path = `subject/${note.statement}.md`
  await putCatalogFile(vault, path, " \r\n\t")
  await putCatalogFile(vault, "unrelated.md", "unchanged")
  const blank = await inspectVaultFile(vault, { path })
  expect(blank.succeeded).toBe(true)
  if (!blank.succeeded) return
  expect(
    await completeBlankFile(vault, { path, expectedHash: blank.output.rawHash, note, confirmed: true }),
  ).toMatchObject({
    succeeded: true,
    output: { note },
  })
  expect(await inspectVaultFile(vault, { path })).toMatchObject({
    succeeded: true,
    output: { analysis: { status: "parsed", frontmatter: note.frontmatter, needsFixing: false } },
  })
  expect(await readFile(join(vault.path, "unrelated.md"), "utf8")).toBe("unchanged")
})

test("stale previews, nonblank content and mismatched statements never change bytes", async () => {
  const vault = await catalogVault()
  const note = aNote()
  const path = `${note.statement}.md`
  await putCatalogFile(vault, path, "")
  const blank = await inspectVaultFile(vault, { path })
  expect(blank.succeeded).toBe(true)
  if (!blank.succeeded) return
  const request = { path, expectedHash: blank.output.rawHash, note, confirmed: true as const }
  expect(await completeBlankFile(vault, { ...request, note: { ...note, statement: "Another" } })).toMatchObject({
    succeeded: false,
    reason: "path-mismatch",
  })
  expect(await readFile(join(vault.path, path), "utf8")).toBe("")
  await putCatalogFile(vault, path, "Obsidian edit")
  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "conflict" })
  const edited = await inspectVaultFile(vault, { path })
  if (!edited.succeeded) throw new Error("Expected raw inspection")
  expect(await completeBlankFile(vault, { ...request, expectedHash: edited.output.rawHash })).toMatchObject({
    succeeded: false,
    reason: "not-blank",
  })
  expect(await readFile(join(vault.path, path), "utf8")).toBe("Obsidian edit")
})

test("completion refuses archive aliases and invalid candidates", async () => {
  const vault = await catalogVault()
  const note = aNote()
  const file = `${note.statement}.md`
  await putCatalogFile(vault, `archive/${file}`, "")
  await linkFolder(join(vault.path, "archive"), join(vault.path, "alias"))
  const blank = await inspectVaultFile(vault, { path: `alias/${file}` })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  const request = { path: `alias/${file}`, expectedHash: blank.output.rawHash, note, confirmed: true as const }
  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "invalid" })
  await putCatalogFile(vault, file, "")
  expect(await completeBlankFile(vault, { ...request, path: file, note: { ...note, body: "" } })).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readFile(join(vault.path, `archive/${file}`), "utf8")).toBe("")
  expect(await readFile(join(vault.path, file), "utf8")).toBe("")
})

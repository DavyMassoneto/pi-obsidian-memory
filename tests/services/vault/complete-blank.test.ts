import { lstat, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { type CompleteBlankRequest, completeBlankFile, inspectVaultFile } from "#/services"
import { aNote, catalogVault, linkFolder, putCatalogFile, tryLinkFile } from "#test-helpers"

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

test("completes an uppercase Markdown extension at the actual existing destination", async () => {
  const vault = await catalogVault()
  const note = { ...aNote(), statement: "Example" }
  const path = "Example.MD"
  await putCatalogFile(vault, path, " \r\n\t")
  const blank = await inspectVaultFile(vault, { path })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  expect(
    await completeBlankFile(vault, {
      path,
      expectedHash: blank.output.rawHash,
      note: { ...note, statement: "example" },
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: false, reason: "path-mismatch" })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(" \r\n\t")
  expect(
    await completeBlankFile(vault, {
      path,
      expectedHash: blank.output.rawHash,
      note,
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: true, output: { note } })
  expect(await readdir(vault.path)).toEqual([path])
  expect((await lstat(join(vault.path, path))).isSymbolicLink()).toBe(false)
  expect(await readFile(join(vault.path, path), "utf8")).toBe(renderNote(note))
})

test("completes an uppercase Markdown file alias without replacing the link or creating a lowercase sibling", async (context) => {
  const vault = await catalogVault()
  const note = { ...aNote(), statement: "Example" }
  const path = "alias/Example.MD"
  await putCatalogFile(vault, "original/Example.MD", " \r\n\t")
  await putCatalogFile(vault, "alias/keep.txt", "unchanged")
  const original = join(vault.path, "original/Example.MD")
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(original, alias))) {
    context.skip("this system cannot create file links")
    return
  }
  const blank = await inspectVaultFile(vault, { path })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  expect(
    await completeBlankFile(vault, {
      path,
      expectedHash: blank.output.rawHash,
      note,
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: true })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readdir(join(vault.path, "original"))).toEqual(["Example.MD"])
  expect((await readdir(join(vault.path, "alias"))).sort()).toEqual(["Example.MD", "keep.txt"])
  expect(await readFile(original, "utf8")).toBe(renderNote(note))
  expect(await readFile(alias, "utf8")).toBe(renderNote(note))
})

test("stale previews, nonblank content and mismatched statements never change bytes", async () => {
  const vault = await catalogVault()
  const note = aNote()
  const path = `${note.statement}.md`
  await putCatalogFile(vault, path, "")
  const blank = await inspectVaultFile(vault, { path })
  expect(blank.succeeded).toBe(true)
  if (!blank.succeeded) return
  const request: CompleteBlankRequest = { path, expectedHash: blank.output.rawHash, note, confirmed: true }
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

test("completion refuses reserved, hidden and escaping uppercase destinations without changing bytes", async () => {
  const vault = await catalogVault()
  const outside = await catalogVault()
  const note = { ...aNote(), statement: "Example" }
  await putCatalogFile(vault, "Example.MD", " \t")
  await putCatalogFile(outside, "Example.MD", " \t")
  const blank = await inspectVaultFile(vault, { path: "Example.MD" })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  for (const path of ["archive/Example.MD", "_templates/Example.MD", ".hidden/Example.MD", "index.MD"]) {
    await putCatalogFile(vault, path, " \t")
    expect(
      await completeBlankFile(vault, {
        path,
        expectedHash: blank.output.rawHash,
        note,
        confirmed: true,
      }),
    ).toMatchObject({ succeeded: false })
    expect(await readFile(join(vault.path, path), "utf8")).toBe(" \t")
  }
  await linkFolder(outside.path, join(vault.path, "escape"))
  expect(
    await completeBlankFile(vault, {
      path: "escape/Example.MD",
      expectedHash: blank.output.rawHash,
      note,
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: false, reason: "outside-vault" })
  expect(await readFile(join(outside.path, "Example.MD"), "utf8")).toBe(" \t")
  expect(await readFile(join(vault.path, "Example.MD"), "utf8")).toBe(" \t")
})

test("completion refuses archive aliases and invalid candidates", async () => {
  const vault = await catalogVault()
  const note = aNote()
  const file = `${note.statement}.md`
  await putCatalogFile(vault, `archive/${file}`, "")
  await linkFolder(join(vault.path, "archive"), join(vault.path, "alias"))
  const blank = await inspectVaultFile(vault, { path: `alias/${file}` })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  const request: CompleteBlankRequest = {
    path: `alias/${file}`,
    expectedHash: blank.output.rawHash,
    note,
    confirmed: true,
  }
  expect(await completeBlankFile(vault, request)).toMatchObject({ succeeded: false, reason: "invalid" })
  await putCatalogFile(vault, file, "")
  expect(await completeBlankFile(vault, { ...request, path: file, note: { ...note, body: "" } })).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readFile(join(vault.path, `archive/${file}`), "utf8")).toBe("")
  expect(await readFile(join(vault.path, file), "utf8")).toBe("")
})

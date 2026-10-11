import { lstat, readdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { inspectVaultFile, updateStoredFile } from "#/services"
import { linkFolder, putCatalogFile, tryLinkFile, vaultWithStoredFile } from "#test-helpers"

test.each([".MD", ".mD", ".Md"])("updates the exact %s entry without a lowercase sibling", async (extension) => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(extension)
  const changed = { ...note, body: "More detail." }
  const result = await updateStoredFile(vault, { path, note: changed, expectedHash: hash })
  expect(result).toMatchObject({ succeeded: true, output: { note: changed } })
  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}${extension}`])
  if (!result.succeeded) throw new Error("Expected update")
  expect(await inspectVaultFile(vault, { path })).toMatchObject({ output: { rawHash: result.output.hash } })
})

test("exact updates preserve real user edits and refuse deleted originals", async () => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(".mD")
  await putCatalogFile(vault, path, "User edit")
  expect(await updateStoredFile(vault, { path, note, expectedHash: hash })).toMatchObject({ reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe("User edit")
  await rm(file)
  expect(await updateStoredFile(vault, { path, note, expectedHash: hash })).toMatchObject({ reason: "conflict" })
  expect(await readdir(join(vault.path, folder))).toEqual([])
})

test("exact updates refuse mismatched statements, invalid names, unsafe paths and invalid candidates", async () => {
  const { vault, note, path, file, hash, text } = await vaultWithStoredFile(".MD")
  for (const statement of ["Another", "exact statement", "index", "[bad]"]) {
    expect(await updateStoredFile(vault, { path, note: { ...note, statement }, expectedHash: hash })).toMatchObject({
      reason: "invalid",
    })
  }
  for (const badPath of [`/${path}`, `../${path}`, `Subject//${note.statement}.MD`, path.replace("/", "\\")]) {
    expect(await updateStoredFile(vault, { path: badPath, note, expectedHash: hash })).toMatchObject({
      reason: "invalid",
    })
  }
  expect(await updateStoredFile(vault, { path, note: { ...note, body: "" }, expectedHash: hash })).toMatchObject({
    reason: "invalid",
  })
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readdir(vault.path)).toEqual(["Subject"])
})

test("diagnostic readability does not permit publishing an invalid exact filename", async () => {
  const { vault, note, text, hash } = await vaultWithStoredFile(".MD")
  const path = "[bad].MD"
  await putCatalogFile(vault, path, text)
  expect(await inspectVaultFile(vault, { path })).toMatchObject({ succeeded: true })
  expect(
    await updateStoredFile(vault, { path, note: { ...note, statement: "[bad]" }, expectedHash: hash }),
  ).toMatchObject({
    reason: "invalid",
  })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
})

test("exact updates follow directory aliases without changing physical entry spelling", async () => {
  const { vault, note, folder, file, hash } = await vaultWithStoredFile(".mD")
  await linkFolder(join(vault.path, folder), join(vault.path, "Alias"))
  const changed = { ...note, body: "Through the directory alias." }
  expect(
    await updateStoredFile(vault, { path: `Alias/${note.statement}.mD`, note: changed, expectedHash: hash }),
  ).toMatchObject({ succeeded: true })
  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}.mD`])
})

test("exact updates retain same-name file aliases and the target's own extension", async (context) => {
  const { vault, note, folder, file, hash } = await vaultWithStoredFile(".mD")
  const path = `${note.statement}.MD`
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  const changed = { ...note, body: "Through the file alias." }
  expect(await updateStoredFile(vault, { path, note: changed, expectedHash: hash })).toMatchObject({ succeeded: true })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}.mD`])
  expect((await readdir(vault.path)).sort()).toEqual([path, folder].sort())
})

test("exact updates refuse differently named canonical targets without replacing the link", async (context) => {
  const { vault, note, file, hash, text } = await vaultWithStoredFile(".MD")
  const alias = join(vault.path, "Other.MD")
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  expect(
    await updateStoredFile(vault, { path: "Other.MD", note: { ...note, statement: "Other" }, expectedHash: hash }),
  ).toMatchObject({ reason: "invalid" })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readFile(file, "utf8")).toBe(text)
})

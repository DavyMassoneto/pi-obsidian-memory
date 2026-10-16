import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { completeBlankFile, inspectVaultFile, updateNote } from "#src/services"
import { aNote, catalogVault, putCatalogFile } from "#test-helpers"

test("the exact-filename writer retains hash and candidate checks for uppercase destinations", async () => {
  const vault = await catalogVault()
  const note = { ...aNote(), statement: "Example" }
  const path = "Example.MD"
  await putCatalogFile(vault, path, " \t")
  const blank = await inspectVaultFile(vault, { path })
  if (!blank.succeeded) throw new Error("Expected raw inspection")
  expect(
    await completeBlankFile(vault, {
      path,
      expectedHash: blank.output.rawHash,
      note: { ...note, body: "" },
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(" \t")
  await putCatalogFile(vault, path, " \n")
  expect(
    await completeBlankFile(vault, {
      path,
      expectedHash: blank.output.rawHash,
      note,
      confirmed: true,
    }),
  ).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(" \n")
  expect(await readdir(vault.path)).toEqual([path])
})

test("the delegated update refuses filename traversal and reserved statements without changing existing bytes", async () => {
  const vault = await catalogVault()
  const note = { ...aNote(), statement: "Example" }
  const text = renderNote(note)
  await putCatalogFile(vault, "Example.md", text)
  const inspected = await inspectVaultFile(vault, { path: "Example.md" })
  if (!inspected.succeeded) throw new Error("Expected raw inspection")
  for (const statement of ["../Example", "folder/Example", "folder\\Example", "index"]) {
    expect(await updateNote(vault, "", { ...note, statement }, inspected.output.rawHash)).toMatchObject({
      succeeded: false,
      reason: "invalid",
    })
  }
  expect(await readFile(join(vault.path, "Example.md"), "utf8")).toBe(text)
  expect(await readdir(vault.path)).toEqual(["Example.md"])
})

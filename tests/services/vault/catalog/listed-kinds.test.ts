import { link, lstat, mkdir, readdir, realpath, symlink } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { enumerateVault } from "#src/services"
import { catalogVault, linkFolder, listedEntry, putCatalogFile, tryLinkFile, useTempFolder } from "#test-helpers"

test("a junction is listed as a symbolic link, never as a directory", async () => {
  const root = await realpath(await useTempFolder())
  await mkdir(join(root, "Real"))
  await linkFolder(join(root, "Real"), join(root, "junction"))

  const listed = await listedEntry(root, "junction")

  expect([listed.isSymbolicLink(), listed.isDirectory(), listed.isFile()]).toEqual([true, false, false])
  expect((await lstat(join(root, "junction"))).isSymbolicLink()).toBe(true)
  expect(await realpath(join(root, "junction"))).toBe(join(root, "Real"))
})

test("a directory symbolic link is listed as a symbolic link", async (context) => {
  const root = await realpath(await useTempFolder())
  await mkdir(join(root, "Real"))
  try {
    await symlink(join(root, "Real"), join(root, "dirlink"), "dir")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      context.skip("this system cannot create directory symbolic links")
      return
    }
    throw error
  }

  const listed = await listedEntry(root, "dirlink")

  expect([listed.isSymbolicLink(), listed.isDirectory(), listed.isFile()]).toEqual([true, false, false])
  expect((await lstat(join(root, "dirlink"))).isSymbolicLink()).toBe(true)
})

test("a file symbolic link is listed as a symbolic link", async (context) => {
  const vault = await catalogVault()
  const root = await realpath(vault.path)
  await putCatalogFile(vault, "Real.md", "x")
  if (!(await tryLinkFile(join(root, "Real.md"), join(root, "filelink.md")))) {
    context.skip("this system cannot create file links")
    return
  }

  const listed = await listedEntry(root, "filelink.md")

  expect([listed.isSymbolicLink(), listed.isDirectory(), listed.isFile()]).toEqual([true, false, false])
  expect((await lstat(join(root, "filelink.md"))).isSymbolicLink()).toBe(true)
})

test("listed regular names are already canonical: on-disk casing, spaces, accents and hard links", async () => {
  const vault = await catalogVault()
  const root = await realpath(vault.path)
  await putCatalogFile(vault, "MixedCase/Ação Nota.MD", "x")
  await putCatalogFile(vault, "plain.md", "x")
  await link(join(root, "plain.md"), join(root, "Hard Link.md"))

  for (const folder of [root, join(root, "MixedCase")]) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      expect(entry.isFile() || entry.isDirectory()).toBe(true)
      expect(entry.isSymbolicLink()).toBe(false)
      expect(await realpath(join(folder, entry.name))).toBe(join(folder, entry.name))
    }
  }
  expect(await realpath(join(root, "mixedcase", "AÇÃO nota.md"))).toBe(join(root, "MixedCase", "Ação Nota.MD"))
})

test("enumeration keeps on-disk casing and still classifies every alias kind beside regular entries", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "Topic/Ação Nota.MD", "x")
  await putCatalogFile(vault, "Topic/plain.md", "x")
  await link(join(vault.path, "Topic/plain.md"), join(vault.path, "Topic/Hard Link.md"))
  await linkFolder(join(vault.path, "Topic"), join(vault.path, "Junction"))
  await linkFolder(vault.path, join(vault.path, "Topic/Loop"))

  const result = await enumerateVault(vault)

  if (!result.succeeded) throw new Error("Expected an enumeration")
  expect(result.output.entries.map((entry) => entry.path)).toEqual([
    "Topic",
    "Topic/Ação Nota.MD",
    "Topic/Hard Link.md",
    "Topic/plain.md",
  ])
  expect(result.output.aliases).toEqual([{ path: "Junction", target: "Topic" }])
  expect(result.output.failures).toEqual([
    expect.objectContaining({ path: "Topic/Loop", reason: "cycle", scope: "directory" }),
  ])
})

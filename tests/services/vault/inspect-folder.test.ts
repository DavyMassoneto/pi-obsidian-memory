import { mkdir, readdir, rmdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectVaultFolder } from "#src/services"
import { linkFolder, useTempFolder } from "#test-helpers"

test("reports a folder that does not exist as missing, creating nothing", async () => {
  const parent = await useTempFolder()

  expect(await inspectVaultFolder(join(parent, "absent"))).toEqual({ succeeded: true, output: "missing" })
  expect(await readdir(parent)).toEqual([])
})

test("reports a directory with no entries as empty", async () => {
  const folder = await useTempFolder()

  expect(await inspectVaultFolder(folder)).toEqual({ succeeded: true, output: "empty" })
  expect(await readdir(folder)).toEqual([])
})

test.each(["note.md", ".DS_Store", "desktop.ini"])("reports a directory holding %s as populated", async (name) => {
  const folder = await useTempFolder()
  await writeFile(join(folder, name), "x")

  expect(await inspectVaultFolder(folder)).toEqual({ succeeded: true, output: "populated" })
  expect(await readdir(folder)).toEqual([name])
})

test("reports a directory holding only an empty subfolder as populated", async () => {
  const folder = await useTempFolder()
  await mkdir(join(folder, "sub"))

  expect(await inspectVaultFolder(folder)).toEqual({ succeeded: true, output: "populated" })
})

test("reports a file path as not-directory", async () => {
  const parent = await useTempFolder()
  const file = join(parent, "note.md")
  await writeFile(file, "x")

  expect(await inspectVaultFolder(file)).toEqual({ succeeded: true, output: "not-directory" })
  expect(await readdir(parent)).toEqual(["note.md"])
})

test("resolves a junction to a populated folder as populated", async () => {
  const parent = await useTempFolder()
  await mkdir(join(parent, "target"))
  await writeFile(join(parent, "target", "note.md"), "x")
  await linkFolder(join(parent, "target"), join(parent, "alias"))

  expect(await inspectVaultFolder(join(parent, "alias"))).toEqual({ succeeded: true, output: "populated" })
})

test("resolves a junction to an empty folder as empty", async () => {
  const parent = await useTempFolder()
  await mkdir(join(parent, "target"))
  await linkFolder(join(parent, "target"), join(parent, "alias"))

  expect(await inspectVaultFolder(join(parent, "alias"))).toEqual({ succeeded: true, output: "empty" })
})

test("reports a junction whose target was removed as missing", async () => {
  const parent = await useTempFolder()
  await mkdir(join(parent, "target"))
  await linkFolder(join(parent, "target"), join(parent, "alias"))
  await rmdir(join(parent, "target"))

  expect(await inspectVaultFolder(join(parent, "alias"))).toEqual({ succeeded: true, output: "missing" })
})

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { writeNewFile } from "#src/services"
import { catalogVault, putCatalogFile } from "#test-helpers"

test("writes the bytes to a file that did not exist", async () => {
  const vault = await catalogVault()
  const bytes = new Uint8Array([80, 75, 3, 4, 0, 255])
  const path = join(vault.path, "export.zip")

  expect(await writeNewFile(path, bytes)).toEqual({ succeeded: true })

  expect(new Uint8Array(await readFile(path))).toEqual(bytes)
  expect(await readdir(vault.path)).toEqual(["export.zip"])
})

test("refuses an existing file and leaves its bytes untouched", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "export.zip", "original")

  const result = await writeNewFile(join(vault.path, "export.zip"), new Uint8Array([1, 2, 3]))

  expect(result).toMatchObject({ succeeded: false, reason: "exists" })
  expect(await readFile(join(vault.path, "export.zip"), "utf8")).toBe("original")
  expect(await readdir(vault.path)).toEqual(["export.zip"])
})

test("refuses a missing folder without creating it", async () => {
  const vault = await catalogVault()

  const result = await writeNewFile(join(vault.path, "missing", "export.zip"), new Uint8Array([1]))

  expect(result).toMatchObject({ succeeded: false, reason: "not-found" })
  expect(await readdir(vault.path)).toEqual([])
})

test("reports an I/O error when the destination is not a writable file path", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "plain.txt", "x")

  const result = await writeNewFile(join(vault.path, "plain.txt", "export.zip"), new Uint8Array([1]))

  expect(result).toMatchObject({ succeeded: false })
  expect(await readFile(join(vault.path, "plain.txt"), "utf8")).toBe("x")
})

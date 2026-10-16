import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { refreshIndexes } from "#src/services"
import { aLimits, linkFolder, readIndexOf, useTempFolder } from "#test-helpers"

const limits = aLimits()

test("does not advertise a regular archive file as the archive folder", async () => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "archive"), "user content")

  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "")).toMatchObject({ succeeded: true })
  expect(await readIndexOf(vault, "")).not.toContain("## Archive")
})

test("adds the Archive section to the root index when the vault has an archive", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "archive"))

  await refreshIndexes({ path: vault, name: "Global memory", limits }, "")

  expect(await readIndexOf(vault, "")).toContain("## Archive\n\n- [[archive/index|archive]]")
})

test("adds the Archive section when the archive folder is spelled in another case", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "Archive"))

  await refreshIndexes({ path: vault, name: "Memory", limits }, "")

  expect(await readIndexOf(vault, "")).toContain("## Archive")
})

test("does not advertise an archive link that leads outside the vault", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "archive"))

  await refreshIndexes({ path: vault, name: "Memory", limits }, "")

  expect(await readIndexOf(vault, "")).not.toContain("## Archive")
  expect(await readdir(outside)).toEqual([])
})

test("never adds the Archive section to the index of a subject folder", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "archive"))
  await mkdir(join(vault, "pnpm"))

  await refreshIndexes({ path: vault, name: "Memory", limits }, "pnpm")

  expect(await readIndexOf(vault, "pnpm")).not.toContain("## Archive")
  expect(await readIndexOf(vault, "")).toContain("## Archive")
})

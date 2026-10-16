import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { createMemoryNote } from "#/services"
import { aLimits, aNote, putNoteFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

test("treats a statement in different Unicode letter case as the same file name", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "", "ÉCOLE", "user note")

  expect(await createMemoryNote({ path: vault, limits }, "", { ...aNote(), statement: "école" })).toMatchObject({
    succeeded: false,
    reason: "exists",
    existingStatement: "ÉCOLE",
  })
  expect(await readFile(join(vault, "ÉCOLE.md"), "utf8")).toBe("user note")
  expect(await readdir(vault)).toEqual(["ÉCOLE.md"])
})

test("does not treat a file that merely contains or starts with the name as the same file", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "", `${aNote().statement} 2`, "other note")
  await putNoteFile(vault, "", `Old ${aNote().statement}`, "older note")

  expect(await createMemoryNote({ path: vault, limits }, "", aNote())).toMatchObject({ succeeded: true })
  expect((await readdir(vault)).sort()).toEqual(
    [`${aNote().statement} 2.md`, `${aNote().statement}.md`, `Old ${aNote().statement}.md`].sort(),
  )
  expect(await readFile(join(vault, `${aNote().statement} 2.md`), "utf8")).toBe("other note")
})

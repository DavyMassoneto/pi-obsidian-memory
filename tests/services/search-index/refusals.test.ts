import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { closeIndex, openIndex, putNote } from "#/services"
import { anEntry, openedIndex, useTempFolder } from "#test-helpers"

test("reports a corrupt database without replacing it or leaking its connection", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  await writeFile(path, "not a SQLite database")

  expect(openIndex(path)).toMatchObject({ succeeded: false, reason: "corrupted", problems: [expect.any(String)] })
  expect(await readFile(path, "utf8")).toBe("not a SQLite database")
  await rm(path)
  const fresh = openedIndex(path)
  expect(putNote(fresh, anEntry())).toEqual({ succeeded: true })
})

test("reports inaccessible index paths as unavailable", async () => {
  const file = join(await useTempFolder(), "file")
  await writeFile(file, "occupied")

  expect(openIndex(join(file, "vault.sqlite"))).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(await readFile(file, "utf8")).toBe("occupied")
})

test("reports a SQLite error that is not corruption as unavailable, keeping its message", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  await mkdir(path)

  const result = openIndex(path)
  if (result.succeeded) result.output.close()
  expect(result).toMatchObject({ succeeded: false, reason: "unavailable", problems: [expect.any(String)] })
})

test("tells the caller to open a new connection when the index is closed", async () => {
  const index = openedIndex(join(await useTempFolder(), "vault.sqlite"))
  closeIndex(index)

  expect(putNote(index, anEntry())).toEqual({
    succeeded: false,
    reason: "closed",
    problems: ["the search index is closed or unusable; open a new connection"],
  })
})

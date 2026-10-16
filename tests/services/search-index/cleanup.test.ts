import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { openIndex, putNote } from "#src/services"
import { anEntry, changeIndexFile, openedIndex, useTempFolder } from "#test-helpers"

test("closes a connection when the FTS table is missing", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  openedIndex(path).close()
  changeIndexFile(path, "DROP TABLE notes_fts")

  expect(openIndex(path)).toMatchObject({ succeeded: false, reason: "corrupted" })
  await rm(path)
  expect(putNote(openedIndex(path), anEntry())).toEqual({ succeeded: true })
})

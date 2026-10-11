import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { closeIndex, putNote, removeNote, searchText } from "#/services"
import { anEntry, openedIndex, useIndexFile } from "#test-helpers"

test("closes idempotently and refuses operations on a closed resource", async () => {
  const { index, path } = await useIndexFile()
  expect(closeIndex(index)).toEqual({ succeeded: true })
  expect(closeIndex(index)).toEqual({ succeeded: true })
  expect(putNote(index, anEntry())).toMatchObject({ succeeded: false, reason: "closed" })
  expect(removeNote(index, anEntry().id)).toMatchObject({ succeeded: false, reason: "closed" })
  expect(searchText(index, "pnpm", { limit: 10, includeArchived: false })).toMatchObject({
    succeeded: false,
    reason: "closed",
  })
  expect(searchText(index, "", { limit: 10, includeArchived: false })).toMatchObject({
    succeeded: false,
    reason: "closed",
  })

  await rm(path)
  expect(putNote(openedIndex(path), anEntry())).toEqual({ succeeded: true })
})

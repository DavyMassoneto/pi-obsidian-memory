import { expect, test } from "vitest"

import { applyIndexChanges, putNote, readIndexInventory, removeNote, searchText } from "#/services"
import { anEntry, catalogChanges, catalogEntry, useIndexFile } from "#test-helpers"

test("legacy archived results preserve the supplied folder field", async () => {
  const { index } = await useIndexFile()
  const entry = { ...anEntry(), archived: true }
  expect(putNote(index, entry)).toEqual({ succeeded: true })
  expect(searchText(index, "pnpm", { limit: 10, includeArchived: true })).toMatchObject({
    succeeded: true,
    output: [{ folder: entry.folder }],
  })
})

test("legacy id-only mutations refuse duplicate ids rather than replacing or deleting either path", async () => {
  const { index } = await useIndexFile()
  const first = catalogEntry("tools/First.md")
  const copy = catalogEntry("tools/Copy.md")
  applyIndexChanges(index, catalogChanges([first, copy], 0))
  const before = readIndexInventory(index)
  expect(putNote(index, anEntry())).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(removeNote(index, anEntry().id)).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(readIndexInventory(index)).toEqual(before)
})

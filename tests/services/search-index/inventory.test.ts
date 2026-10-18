import { expect, test } from "vitest"

import { applyIndexChanges, openIndex, readIndexInventory, recoverIndex, searchCatalog } from "#src/services"
import { catalogChanges, catalogEntry, changeIndexFile, useIndexFile } from "#test-helpers"

test("persists partial population across reopen and reports migration as needing population", async () => {
  const { index, path } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  applyIndexChanges(index, { ...catalogChanges([entry], 0), population: "needs-population" })
  index.close()
  const reopened = openIndex(path)
  if (!reopened.succeeded) throw new Error("open failed")
  expect(reopened.rebuilt).toBe(false)
  expect(readIndexInventory(reopened.output)).toMatchObject({
    succeeded: true,
    output: { entries: [entry], population: "needs-population" },
  })
  reopened.output.close()
  changeIndexFile(path, "PRAGMA user_version = 1")
  const migrated = openIndex(path)
  if (!migrated.succeeded) throw new Error("migration failed")
  expect(migrated.rebuilt).toBe(true)
  expect(readIndexInventory(migrated.output)).toEqual({
    succeeded: true,
    output: { entries: [], revision: 0, population: "needs-population" },
  })
  migrated.output.close()
})

test("rejects malformed cached boolean flags rather than coercing them into valid search hits", async () => {
  const { index, path } = await useIndexFile()
  applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))
  changeIndexFile(path, "UPDATE notes SET dont_forget = 'invalid'")
  expect(readIndexInventory(index)).toMatchObject({ succeeded: false, reason: "corrupted" })
  expect(searchCatalog(index, { query: "pnpm" })).toMatchObject({ succeeded: false, reason: "corrupted" })
  changeIndexFile(path, "UPDATE notes SET dont_forget = NULL")
  expect(searchCatalog(index, { query: "pnpm" })).toMatchObject({ succeeded: false, reason: "corrupted" })
  expect(applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 1))).toEqual({ succeeded: true })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { revision: 2 } })
})

test("preserves frontmatter-archived identity outside archive while excluding it from search after reopen", async () => {
  const { index, path } = await useIndexFile()
  const entry = catalogEntry("Retired.md")
  if (!entry.note) throw new Error("note required")
  entry.note.archived = true
  expect(applyIndexChanges(index, catalogChanges([entry], 0))).toEqual({ succeeded: true })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { entries: [entry] } })
  expect(searchCatalog(index, { query: "pnpm" })).toEqual({ succeeded: true, output: [] })
  index.close()
  const reopened = recoverIndex({ path })
  if (!reopened.succeeded) throw new Error("reopen required")
  try {
    expect(reopened.rebuilt).toBe(false)
    expect(readIndexInventory(reopened.output)).toMatchObject({ succeeded: true, output: { entries: [entry] } })
    expect(searchCatalog(reopened.output, { query: "pnpm" })).toEqual({ succeeded: true, output: [] })
    expect(applyIndexChanges(reopened.output, catalogChanges([catalogEntry("archive/False.md")], 1))).toMatchObject({
      succeeded: false,
      reason: "invalid",
    })
    expect(readIndexInventory(reopened.output)).toMatchObject({
      succeeded: true,
      output: { entries: [entry], revision: 1 },
    })
  } finally {
    reopened.output.close()
  }
})

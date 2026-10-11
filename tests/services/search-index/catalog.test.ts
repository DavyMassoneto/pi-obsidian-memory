import { expect, test } from "vitest"

import { applyIndexChanges, readIndexInventory, searchCatalog } from "#/services"
import { catalogChanges, catalogEntry, changeIndexFile, useIndexFile } from "#test-helpers"

test("persists path identities, invalid-frontmatter inventory and full search metadata", async () => {
  const { index, path } = await useIndexFile()
  expect(readIndexInventory(index)).toEqual({
    succeeded: true,
    output: { entries: [], revision: 0, population: "needs-population" },
  })
  const first = catalogEntry("tools/First.md")
  const copy = { ...catalogEntry("tools/Copy.md"), needsFixing: true }
  const invalid = { ...catalogEntry("tools/Invalid.md"), note: null, contentFingerprint: null, needsFixing: true }
  expect(applyIndexChanges(index, catalogChanges([first, copy, invalid], 0))).toEqual({ succeeded: true })
  const result = searchCatalog(index, { query: "pnpm", limit: 10 })
  expect(result).toMatchObject({
    succeeded: true,
    output: [
      { path: copy.path, id: copy.note?.id, type: "rule", dontForget: true, needsFixing: true },
      { path: first.path, id: first.note?.id, type: "rule", dontForget: true, needsFixing: false },
    ],
  })
  expect(readIndexInventory(index)).toEqual({
    succeeded: true,
    output: { entries: [copy, first, invalid], revision: 1, population: "ready" },
  })
  expect(applyIndexChanges(index, { ...catalogChanges([], 0), deletes: [first.path] })).toMatchObject({
    succeeded: false,
    reason: "conflict",
  })
  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
})

test("atomically replaces searchable text with malformed content and excludes root archives", async () => {
  const { index } = await useIndexFile()
  const first = catalogEntry("tools/First.md")
  const archive = catalogEntry("archive/First.md")
  if (!archive.note) throw new Error("fixture")
  archive.note.archived = true
  const nested = catalogEntry("tools/archive/First.md")
  applyIndexChanges(index, catalogChanges([first, archive, nested], 0))
  const invalid = { ...first, note: null, contentFingerprint: null, needsFixing: true }
  const changes = {
    ...catalogChanges([invalid], 1),
    statUpdates: [{ path: nested.path, stat: { size: 100, mtimeMs: 2000 } }],
  }
  expect(applyIndexChanges(index, changes)).toEqual({ succeeded: true })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: nested.path }],
  })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { revision: 2 } })
})

test.each(["FAIL", "ABORT", "ROLLBACK"])("rolls back the whole reconciliation batch on %s", async (mode) => {
  const { index, path } = await useIndexFile()
  const first = catalogEntry("tools/First.md")
  applyIndexChanges(index, catalogChanges([first], 0))
  const before = readIndexInventory(index)
  changeIndexFile(
    path,
    `CREATE TRIGGER refuse_catalog AFTER INSERT ON notes BEGIN SELECT RAISE(${mode}, 'batch refused'); END;`,
  )
  const changes = { ...catalogChanges([catalogEntry("tools/Second.md")], 1), deletes: [first.path] }
  expect(applyIndexChanges(index, changes)).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(readIndexInventory(index)).toEqual(before)
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: first.path }],
  })
  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
})

test("refuses noncanonical paths and ambiguous batches before changing any state", async () => {
  const { index } = await useIndexFile()
  for (const path of ["../outside.md", "tools//Note.md", "tools/", "C:/Note.md", "tools\\Note.md"]) {
    expect(applyIndexChanges(index, catalogChanges([catalogEntry(path)], 0))).toMatchObject({
      succeeded: false,
      reason: "invalid",
    })
  }
  const entry = catalogEntry("tools/First.md")
  expect(applyIndexChanges(index, { ...catalogChanges([entry], 0), deletes: [entry.path] })).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { entries: [], revision: 0 } })
})

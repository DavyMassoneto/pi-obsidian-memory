import { expect, test } from "vitest"

import { applyIndexChanges, readIndexInventory, searchCatalog } from "#/services"
import { catalogChanges, catalogEntry, changeIndexFile, holdIndexLock, useIndexFile } from "#test-helpers"

test("stat-only changes leave the text index untouched", async () => {
  const { index, path } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  applyIndexChanges(index, catalogChanges([entry], 0))
  changeIndexFile(
    path,
    "CREATE TRIGGER reject_text AFTER UPDATE OF statement, body ON notes BEGIN SELECT RAISE(ABORT, 'text changed'); END;",
  )
  const stat = { size: 100, mtimeMs: 3000 }
  expect(applyIndexChanges(index, { ...catalogChanges([], 1), statUpdates: [{ path: entry.path, stat }] })).toEqual({
    succeeded: true,
  })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { entries: [{ ...entry, stat }] } })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: entry.path }],
  })
})

test("contention refuses without advancing the revision and retries the same batch after release", async () => {
  const { index, path } = await useIndexFile()
  const changes = catalogChanges([catalogEntry("tools/First.md")], 0)
  const release = holdIndexLock(path, "write")
  expect(applyIndexChanges(index, changes)).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { entries: [], revision: 0 } })
  release()
  expect(applyIndexChanges(index, changes)).toEqual({ succeeded: true })
  index.close()
  expect(readIndexInventory(index)).toMatchObject({ succeeded: false, reason: "closed" })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({ succeeded: false, reason: "closed" })
  expect(applyIndexChanges(index, changes)).toMatchObject({ succeeded: false, reason: "closed" })
})

test("a missing stat-only target rolls back prior deletions", async () => {
  const { index } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  applyIndexChanges(index, catalogChanges([entry], 0))
  const changes = {
    ...catalogChanges([], 1),
    deletes: [entry.path],
    statUpdates: [{ path: "missing.md", stat: entry.stat }],
  }
  expect(applyIndexChanges(index, changes)).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(readIndexInventory(index)).toMatchObject({ succeeded: true, output: { entries: [entry], revision: 1 } })
})

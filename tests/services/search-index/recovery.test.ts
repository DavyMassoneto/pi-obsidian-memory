import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import { applyIndexChanges, readIndexInventory, recoverIndex, searchCatalog } from "#src/services"
import {
  assertIndexConsistent,
  catalogChanges,
  catalogEntry,
  changeIndexFile,
  holdIndexLock,
  useIndexFile,
} from "#test-helpers"

test("replaces only a corrupt disposable index and reports that notes must repopulate it", async () => {
  const { index, path } = await useIndexFile()
  index.close()
  await writeFile(path, "not a database")
  const recovered = recoverIndex({ path })
  if (!recovered.succeeded) throw new Error(recovered.problems.join("; "))
  expect(recovered.rebuilt).toBe(true)
  expect(readIndexInventory(recovered.output)).toMatchObject({
    succeeded: true,
    output: { entries: [], population: "needs-population" },
  })
  recovered.output.close()
  expect(await readdir(dirname(path))).toEqual(["vault.sqlite"])
})

test("also rebuilds a missing vector cache table instead of opening a partly usable schema", async () => {
  const { index, path } = await useIndexFile()
  index.close()
  changeIndexFile(path, "DROP TABLE vector_generation")
  const result = recoverIndex({ path })
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  result.output.close()
  expect(result.rebuilt).toBe(true)
})

test("rebuilds an invalid cached row even when SQLite can prepare its schema", async () => {
  const { index, path } = await useIndexFile()
  applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))
  index.close()
  changeIndexFile(path, "UPDATE notes SET id = 'not-a-ulid'")
  const result = recoverIndex({ path })
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  result.output.close()
  expect(result.rebuilt).toBe(true)
})

test("rebuilds an external-content FTS index that lost its postings and persists needs-population", async () => {
  const { index, path } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  expect(applyIndexChanges(index, catalogChanges([entry], 0))).toEqual({ succeeded: true })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: entry.path }],
  })
  expect(index.close()).toEqual({ succeeded: true })
  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts) VALUES ('delete-all')")

  const recovered = recoverIndex({ path })
  if (!recovered.succeeded) throw new Error(recovered.problems.join("; "))
  const inventory = readIndexInventory(recovered.output)
  recovered.output.close()

  expect(recovered.rebuilt).toBe(true)
  expect(inventory).toEqual({
    succeeded: true,
    output: { entries: [], revision: 0, population: "needs-population" },
  })
  assertIndexConsistent(path)
  const reopened = recoverIndex({ path })
  if (!reopened.succeeded) throw new Error(reopened.problems.join("; "))
  expect(readIndexInventory(reopened.output)).toEqual(inventory)
  reopened.output.close()
  expect(reopened.rebuilt).toBe(false)
  expect(await readdir(dirname(path))).toEqual(["vault.sqlite"])
})

test("preserves a healthy populated catalog and searchable postings on recovery", async () => {
  const { index, path } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  expect(applyIndexChanges(index, catalogChanges([entry], 0))).toEqual({ succeeded: true })
  const inventory = readIndexInventory(index)
  const hits = searchCatalog(index, { query: "pnpm", limit: 10 })
  index.close()

  const recovered = recoverIndex({ path })
  if (!recovered.succeeded) throw new Error(recovered.problems.join("; "))
  expect(readIndexInventory(recovered.output)).toEqual(inventory)
  expect(searchCatalog(recovered.output, { query: "pnpm", limit: 10 })).toEqual(hits)
  recovered.output.close()
  expect(recovered.rebuilt).toBe(false)
  assertIndexConsistent(path)
})

test("rolls back a reader-blocked open without rebuilding or retaining a transaction", async () => {
  const { index, path } = await useIndexFile()
  expect(applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))).toEqual({ succeeded: true })
  const inventory = readIndexInventory(index)
  index.close()
  const before = await readFile(path)
  const release = holdIndexLock(path, "read")

  const blocked = recoverIndex({ path })
  release()
  expect(blocked).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(await readFile(path)).toEqual(before)
  expect(await readdir(dirname(path))).toEqual(["vault.sqlite"])

  const recovered = recoverIndex({ path })
  if (!recovered.succeeded) throw new Error(recovered.problems.join("; "))
  expect(readIndexInventory(recovered.output)).toEqual(inventory)
  recovered.output.close()
  expect(recovered.rebuilt).toBe(false)
  assertIndexConsistent(path)
})

test("does not replace a busy database or leave a sibling temporary database", async () => {
  const { index, path } = await useIndexFile()
  index.close()
  const before = await readFile(path)
  const release = holdIndexLock(path, "write")
  expect(recoverIndex({ path })).toMatchObject({ succeeded: false, reason: "unavailable" })
  release()
  expect(await readFile(path)).toEqual(before)
  expect(await readdir(dirname(path))).toEqual(["vault.sqlite"])
})

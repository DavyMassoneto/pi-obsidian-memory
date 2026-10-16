import { mkdir, rm, stat } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { applyIndexChanges, enumerateVault, readIndexInventory, reconcileCatalog, searchCatalog } from "#/services"
import {
  catalogChanges,
  catalogEntry,
  catalogVault,
  changeIndexFile,
  holdIndexLock,
  noteText,
  putCatalogFile,
  useIndexFile,
  validFrontmatterLines,
} from "#test-helpers"

test("real vault directory replacement removes a cached note using actual enumeration coverage", async () => {
  const vault = await catalogVault()
  const { index } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  await putCatalogFile(vault, entry.path, noteText(validFrontmatterLines(), "Install packages with pnpm."))
  expect(applyIndexChanges(index, catalogChanges([entry], 0))).toEqual({ succeeded: true })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: entry.path }],
  })
  await rm(join(vault.path, entry.path))
  await mkdir(join(vault.path, entry.path))
  const enumeration = await enumerateVault(vault)
  const inventory = readIndexInventory(index)
  if (!enumeration.succeeded || !inventory.succeeded) throw new Error("Expected both resources")
  expect(enumeration.output.failures).toEqual([])
  const plan = reconcileCatalog(inventory.output, {
    entries: [],
    observedPaths: enumeration.output.observedPaths,
    completeDirectories: enumeration.output.completeDirectories,
    failedPaths: enumeration.output.failures.map((failure) => failure.path),
    untraversedAliasDirectories: [],
    excludedAliasFiles: [],
    validationFingerprint: entry.validationFingerprint,
    complete: true,
  })
  expect(plan.deletes).toEqual([entry.path])
  expect(applyIndexChanges(index, plan)).toEqual({ succeeded: true })
  expect(readIndexInventory(index)).toEqual({
    succeeded: true,
    output: { entries: [], revision: 2, population: "ready" },
  })
  expect(searchCatalog(index, { query: "pnpm", limit: 10 })).toEqual({ succeeded: true, output: [] })
  expect((await stat(join(vault.path, entry.path))).isDirectory()).toBe(true)
})

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

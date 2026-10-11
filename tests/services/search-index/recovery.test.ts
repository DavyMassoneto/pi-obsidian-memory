import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import { applyIndexChanges, readIndexInventory, recoverIndex } from "#/services"
import { catalogChanges, catalogEntry, changeIndexFile, holdIndexLock, useIndexFile } from "#test-helpers"

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

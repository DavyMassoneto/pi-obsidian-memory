import { expect, test } from "vitest"

import { putNote, searchText } from "#src/services"
import { anEntry, assertIndexConsistent, holdIndexLock, openedIndex, useIndexFile } from "#test-helpers"

const defaults = { includeArchived: false }

test("refuses a contended BEGIN without changing the resource or rolling back another connection", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())
  const before = searchText(index, "pnpm", defaults)
  expect(before).toMatchObject({ succeeded: true, output: [{ statement: anEntry().statement }] })
  const release = holdIndexLock(path, "write")

  expect(putNote(index, { ...anEntry(), statement: "Use yarn" })).toMatchObject({
    succeeded: false,
    reason: "unavailable",
    problems: [expect.stringContaining("locked")],
  })
  expect(searchText(index, "pnpm", defaults)).toEqual(before)
  expect(putNote(index, anEntry())).toMatchObject({ succeeded: false, reason: "unavailable" })
  release()

  expect(putNote(index, anEntry())).toEqual({ succeeded: true })
  assertIndexConsistent(path)
})

test("rolls back both tables when a reader blocks COMMIT, allowing another write afterward", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())
  const before = searchText(index, "pnpm", defaults)
  expect(before).toMatchObject({ succeeded: true, output: [{ statement: anEntry().statement }] })
  const release = holdIndexLock(path, "read")

  expect(putNote(index, { ...anEntry(), statement: "Use yarn", body: "Yarn everywhere" })).toMatchObject({
    succeeded: false,
    reason: "unavailable",
    problems: [expect.stringContaining("locked")],
  })
  release()
  expect(searchText(index, "pnpm", defaults)).toEqual(before)
  expect(searchText(index, "yarn", defaults)).toEqual({ succeeded: true, output: [] })
  assertIndexConsistent(path)
  index.close()

  const reopened = openedIndex(path)
  expect(searchText(reopened, "pnpm", defaults)).toEqual(before)
  expect(putNote(reopened, anEntry())).toEqual({ succeeded: true })
})

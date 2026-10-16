import { expect, test } from "vitest"

import { putNote, removeNote, searchText } from "#src/services"
import {
  anEntry,
  assertIndexConsistent,
  changeIndexFile,
  entryWith,
  openedIndex,
  statementsOf,
  useIndexFile,
  useTempIndex,
} from "#test-helpers"

const defaults = { limit: 10, includeArchived: false }

test("updates the same id, forgetting its old words even after reopening", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())
  expect(putNote(index, { ...anEntry(), statement: "Use yarn, never npm", body: "Yarn everywhere." })).toEqual({
    succeeded: true,
  })
  index.close()

  const reopened = openedIndex(path)
  expect(statementsOf(searchText(reopened, "npm", defaults))).toEqual(["Use yarn, never npm"])
  expect(searchText(reopened, "pnpm", defaults)).toEqual({ succeeded: true, output: [] })
  assertIndexConsistent(path)
})

test("forgets a removed note and permits removing an absent id", async () => {
  const { index, path } = await useIndexFile()
  expect(putNote(index, anEntry())).toEqual({ succeeded: true })
  expect(statementsOf(searchText(index, "pnpm", defaults))).toEqual([anEntry().statement])

  expect(removeNote(index, anEntry().id)).toEqual({ succeeded: true })
  expect(removeNote(index, anEntry().id)).toEqual({ succeeded: true })
  index.close()

  expect(searchText(openedIndex(path), "pnpm", defaults)).toEqual({ succeeded: true, output: [] })
  assertIndexConsistent(path)
})

test("leaves no trace of removed or replaced text in ranking", async () => {
  const withRemoved = await useTempIndex()
  const alone = await useTempIndex()
  const other = entryWith("01JABCDE7XKQ2M9V3RTN8WPZ60", "Use pnpm in CI", "Frozen lockfile.")
  putNote(withRemoved, anEntry())
  putNote(withRemoved, { ...other, body: "pnpm pnpm pnpm pnpm" })
  putNote(withRemoved, other)
  putNote(alone, other)
  removeNote(withRemoved, anEntry().id)

  expect(statementsOf(searchText(alone, "pnpm", defaults))).toEqual([other.statement])
  expect(searchText(withRemoved, "pnpm", defaults)).toEqual(searchText(alone, "pnpm", defaults))
})

test.each(["ABORT", "ROLLBACK", "FAIL"])(
  "preserves the original failure and both tables on failed update (%s)",
  async (mode) => {
    const { index, path } = await useIndexFile()
    putNote(index, anEntry())
    const before = searchText(index, "pnpm", defaults)
    expect(statementsOf(before)).toEqual([anEntry().statement])
    changeIndexFile(
      path,
      `
      CREATE TRIGGER reject_update AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, statement, body)
          VALUES ('delete', old.rowid, old.statement, old.body);
        SELECT RAISE(${mode}, 'write deliberately refused');
      END;
    `,
    )

    const result = putNote(index, { ...anEntry(), statement: "Use yarn", body: "Yarn everywhere" })
    expect(result).toMatchObject({ succeeded: false, reason: "unavailable" })
    if (result.succeeded) throw new Error("expected refusal")
    expect(result.problems).toEqual([expect.stringContaining("write deliberately refused")])
    expect(searchText(index, "pnpm", defaults)).toEqual(before)
    expect(searchText(index, "yarn", defaults)).toEqual({ succeeded: true, output: [] })
    assertIndexConsistent(path)
    changeIndexFile(path, "DROP TRIGGER reject_update")
    expect(putNote(index, { ...anEntry(), statement: "Use yarn", body: "Yarn everywhere" })).toEqual({
      succeeded: true,
    })
  },
)

test("rolls back a failed insert after the trigger has written to FTS", async () => {
  const { index, path } = await useIndexFile()
  changeIndexFile(
    path,
    `
      CREATE TRIGGER reject_insert AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, statement, body) VALUES (new.rowid, new.statement, new.body);
        SELECT RAISE(ABORT, 'insert deliberately refused');
      END;
    `,
  )

  expect(putNote(index, anEntry())).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(searchText(index, "pnpm", defaults)).toEqual({ succeeded: true, output: [] })
  assertIndexConsistent(path)
  changeIndexFile(path, "DROP TRIGGER reject_insert")
  expect(putNote(index, anEntry())).toEqual({ succeeded: true })
})

test("rolls back a failed removal after the trigger has removed FTS text", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())
  const before = searchText(index, "pnpm", defaults)
  expect(statementsOf(before)).toEqual([anEntry().statement])
  changeIndexFile(
    path,
    `
      CREATE TRIGGER reject_delete AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, statement, body)
          VALUES ('delete', old.rowid, old.statement, old.body);
        SELECT RAISE(ABORT, 'delete deliberately refused');
      END;
    `,
  )

  expect(removeNote(index, anEntry().id)).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(searchText(index, "pnpm", defaults)).toEqual(before)
  assertIndexConsistent(path)
  changeIndexFile(path, "DROP TRIGGER reject_delete")
  expect(removeNote(index, anEntry().id)).toEqual({ succeeded: true })
})

test("refuses invalid entries before either table changes", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())

  expect(putNote(index, { ...anEntry(), size: Number.NaN })).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(statementsOf(searchText(index, "pnpm", defaults))).toEqual([anEntry().statement])
  assertIndexConsistent(path)
})

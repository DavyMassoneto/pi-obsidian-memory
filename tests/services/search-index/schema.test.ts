import { join } from "node:path"

import { expect, test } from "vitest"

import { openIndex, putNote, searchText } from "#src/services"
import { anEntry, changeIndexFile, legacyIndexState, openedIndex, statementsOf, useTempFolder } from "#test-helpers"

test("rebuilds an incompatible derived schema without pretending to restore vault content", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  changeIndexFile(path, "CREATE TABLE notes (id TEXT PRIMARY KEY); INSERT INTO notes VALUES ('legacy')")

  const result = openIndex(path)
  expect(result).toMatchObject({ succeeded: true, rebuilt: true })
  if (!result.succeeded) throw new Error("rebuild failed")
  expect(searchText(result.output, "legacy", { limit: 10, includeArchived: false })).toEqual({
    succeeded: true,
    output: [],
  })
  expect(putNote(result.output, anEntry())).toEqual({ succeeded: true })
  result.output.close()

  const reopened = openedIndex(path)
  expect(statementsOf(searchText(reopened, "pnpm", { limit: 10, includeArchived: false }))).toEqual([
    anEntry().statement,
  ])
})

test("rolls back schema and version changes together if rebuilding fails after dropping old tables", async () => {
  const path = join(await useTempFolder(), "vault.sqlite")
  changeIndexFile(
    path,
    `
      CREATE TABLE notes (id TEXT PRIMARY KEY);
      INSERT INTO notes VALUES ('legacy');
      CREATE TABLE keeper (id TEXT);
      CREATE TRIGGER notes_insert AFTER INSERT ON keeper BEGIN SELECT 1; END;
    `,
  )

  expect(openIndex(path)).toMatchObject({
    succeeded: false,
    reason: "corrupted",
    problems: [expect.stringContaining("notes_insert already exists")],
  })
  expect(legacyIndexState(path)).toEqual({ version: 0, id: "legacy" })
  changeIndexFile(path, "DROP TRIGGER notes_insert")
  expect(putNote(openedIndex(path), anEntry())).toEqual({ succeeded: true })
})

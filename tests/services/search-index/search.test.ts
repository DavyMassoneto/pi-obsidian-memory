import { expect, test } from "vitest"

import { putNote, searchText } from "#/services"
import {
  anEntry,
  changeIndexFile,
  entryWith,
  searchHits,
  statementsOf,
  useIndexFile,
  useTempIndex,
} from "#test-helpers"

const defaults = { limit: 10, includeArchived: false }

test("finds a note by a word of its statement or of its body", async () => {
  const index = await useTempIndex()
  putNote(index, anEntry())

  expect(searchHits(searchText(index, "pnpm", defaults))).toEqual([
    {
      id: anEntry().id,
      folder: "tools/pnpm",
      statement: "Use pnpm, never npm",
      type: "rule",
      score: expect.any(Number),
    },
  ])
  expect(statementsOf(searchText(index, "script", defaults))).toEqual(["Use pnpm, never npm"])
})

test("matches other forms of the same English word", async () => {
  const index = await useTempIndex()
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ60", "User prefers short, direct answers", "Keep replies brief."))

  expect(statementsOf(searchText(index, "answer", defaults))).toEqual(["User prefers short, direct answers"])
})

test("weighs a word in the statement more than the same word in the body", async () => {
  const index = await useTempIndex()
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ60", "Some unrelated detail", "Use pnpm here"))
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ61", "Use pnpm here", "Some unrelated detail"))
  for (const [suffix, statement] of [
    ["62", "Strict mode always on"],
    ["63", "No ternaries"],
    ["64", "Deploy runs on Fridays"],
    ["65", "Tests use real disk"],
  ]) {
    putNote(index, entryWith(`01JABCDE7XKQ2M9V3RTN8WPZ${suffix}`, `${statement}`, "Filler."))
  }

  const hits = searchHits(searchText(index, "pnpm", defaults))
  const distinctScores = new Set(hits.map((hit) => hit.score))

  expect(hits.map((hit) => hit.statement)).toEqual(["Use pnpm here", "Some unrelated detail"])
  expect(distinctScores.size).toBe(2)
})

test("finds notes that match any term, ranking those that match more terms first", async () => {
  const index = await useTempIndex()
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ60", "Lockfile is committed", "Never ignore it."))
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ61", "CI uses the pnpm lockfile", "Frozen install."))

  expect(statementsOf(searchText(index, "pnpm lockfile", defaults))).toEqual([
    "CI uses the pnpm lockfile",
    "Lockfile is committed",
  ])
})

test("ignores common English words, and a query made only of them finds nothing", async () => {
  const index = await useTempIndex()
  putNote(index, entryWith("01JABCDE7XKQ2M9V3RTN8WPZ60", "The build is slow", "It is what it is."))

  expect(statementsOf(searchText(index, "what is the build", defaults))).toEqual(["The build is slow"])
  expect(searchText(index, "what is the", defaults)).toEqual({ succeeded: true, output: [] })
})

test.each([
  ["an unclosed quote", '"pnpm'],
  ["search operators", "pnpm NEAR( OR AND NOT"],
  ["punctuation", "pnpm: (npm)?*"],
])("treats %s as plain words", async (_case, query) => {
  const index = await useTempIndex()
  putNote(index, anEntry())

  expect(statementsOf(searchText(index, query, defaults))).toEqual(["Use pnpm, never npm"])
})

test("leaves archived notes out unless asked to include them", async () => {
  const index = await useTempIndex()
  putNote(index, { ...anEntry(), archived: true })

  expect(searchText(index, "pnpm", defaults)).toEqual({ succeeded: true, output: [] })
  expect(statementsOf(searchText(index, "pnpm", { ...defaults, includeArchived: true }))).toEqual([
    "Use pnpm, never npm",
  ])
})

test("reports SQLite query failures from an externally damaged schema", async () => {
  const { index, path } = await useIndexFile()
  putNote(index, anEntry())
  changeIndexFile(path, "DROP TABLE notes_fts")

  expect(searchText(index, "pnpm", defaults)).toMatchObject({ succeeded: false, reason: "corrupted" })
})

test("returns at most the asked number of notes", async () => {
  const index = await useTempIndex()
  for (const suffix of ["60", "61", "62"]) {
    putNote(index, entryWith(`01JABCDE7XKQ2M9V3RTN8WPZ${suffix}`, `pnpm note ${suffix}`, "pnpm"))
  }

  expect(searchHits(searchText(index, "pnpm", { ...defaults, limit: 2 }))).toHaveLength(2)
})

import { expect, test } from "vitest"

import { observeRead, searchMemory, searchRelevantNotes } from "#src/usecases"
import { noteWithId, putCatalogFile, putDontForget, putNote, relevantFixture } from "#test-helpers"

test("reads every search hit in both vaults, excluding Don't forget and already loaded hashes", async () => {
  const { vault, project, context, loaded } = await relevantFixture()
  const remembered = await putNote(vault, "Remembered", 1, "pnpm remembered")
  await putDontForget(vault, "Always", 2, "pnpm always")
  for (let number = 3; number <= 15; number++) {
    await putCatalogFile(project, `tools/Project ${number}.md`, noteWithId(number, "pnpm project", []))
  }
  const read = await observeRead({ vault: "global", path: remembered }, context)
  expect(typeof read).not.toBe("string")
  if (typeof read === "string") throw new Error(read)
  loaded.remember(read)
  const search = await searchMemory({ query: "pnpm", vault: "both" }, context)
  expect(search.succeeded).toBe(true)
  if (!search.succeeded) throw new Error(search.problems.join("; "))
  const expected = search.output.vaults.flatMap((entry) => {
    if (!("hits" in entry)) return []
    return entry.hits.filter((hit) => hit.path !== remembered && !hit.dontForget).map((hit) => hit.path)
  })

  const result = await searchRelevantNotes("pnpm", context, loaded)

  expect(expected).toHaveLength(13)
  expect(result.notes.map((note) => note.path)).toEqual(expected)
  expect(result.notes.every((note) => note.kind === "read" && note.body.includes("pnpm"))).toBe(true)
  expect(result.notice).toBeNull()
  await putCatalogFile(vault, remembered, noteWithId(1, "pnpm changed", []))
  const changed = await searchRelevantNotes("pnpm", context, loaded)
  expect(changed.notes.find((note) => note.path === remembered)?.body).toBe("pnpm changed")
})

test("searches the global vault when there is no registered project", async () => {
  const { vault, context, loaded, config } = await relevantFixture()
  const { writeRegistrationSnapshot } = await import("#test-helpers")
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [] }))
  await putNote(vault, "Global", 1, "pnpm global")

  const result = await searchRelevantNotes("pnpm", context, loaded)

  expect(result.notes.map((note) => [note.vault, note.path])).toEqual([["global", "tools/Global.md"]])
})

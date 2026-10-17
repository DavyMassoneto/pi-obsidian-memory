import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { searchMemory } from "#src/usecases"
import {
  conceptVault,
  inFreshSession,
  noteWithId,
  putCatalogFile,
  putConceptNotes,
  searchedHits,
  semanticFixture,
  synchronizedIndexPath,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a paraphrase that shares no words with the note finds it through the vectors", async () => {
  const fixture = await conceptVault()

  const words = await searchMemory({ query: "automobile", vault: "global" }, fixture.plainContext)
  const fused = await searchMemory({ query: "automobile", vault: "global" }, fixture.context)

  expect(searchedHits(words, "global")).toEqual([])
  expect(searchedHits(fused, "global").map((hit) => hit.path)).toEqual(["vehicles/Car.md"])
  expect(fused).toMatchObject({ succeeded: true, output: { semantic: { mode: "fused", problems: [] } } })
  expect(fixture.embedder.queries).toEqual(["automobile"])
})

test("a note found by its words and a note found by meaning are both returned", async () => {
  const fixture = await conceptVault()
  await putCatalogFile(fixture.vault, "Garage.md", noteWithId(3, "The automobile stays in the garage.", []))

  const result = await searchMemory({ query: "automobile", vault: "global" }, fixture.context)

  expect(
    searchedHits(result, "global")
      .map((hit) => hit.path)
      .sort(),
  ).toEqual(["Garage.md", "vehicles/Car.md"])
})

test("deleting the index gives the same results", async () => {
  const fixture = await conceptVault()
  const before = await searchMemory({ query: "automobile", vault: "global" }, fixture.context)

  await rm(await synchronizedIndexPath(fixture.context, fixture.vault.path), { force: true })
  const after = await searchMemory({ query: "automobile", vault: "global" }, fixture.context)

  expect(searchedHits(before, "global")).toHaveLength(1)
  expect(after).toEqual(before)
})

test("when semantic search is off the answer is text only and says why", async () => {
  const fixture = await conceptVault()
  await putCatalogFile(fixture.vault, "Garage.md", noteWithId(3, "The automobile stays in the garage.", []))
  const off = {
    ...fixture.context,
    semantic: async () => ({ available: false as const, reason: "model download declined" }),
  }

  const result = await searchMemory({ query: "automobile", vault: "global" }, off)

  expect(searchedHits(result, "global").map((hit) => hit.path)).toEqual(["Garage.md"])
  expect(result).toMatchObject({
    output: { semantic: { mode: "text-only", problems: ["Semantic search is off: model download declined"] } },
  })
})

test("a query that cannot be embedded falls back to words and says so", async () => {
  const fixture = await conceptVault()
  const failing = {
    ...fixture.context,
    semantic: async () => ({
      available: true as const,
      embed: async () => ({ succeeded: false as const, status: "unavailable" as const }),
    }),
  }

  const result = await searchMemory({ query: "automobile", vault: "global" }, failing)

  expect(result).toMatchObject({
    succeeded: true,
    output: { semantic: { mode: "text-only", problems: [expect.stringContaining("query could not be embedded")] } },
  })
})

test("with only some notes embedded the search still answers and says how many are missing", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 40)
  fixture.embedder.failFrom = { batch: 2, status: "unavailable" }

  const result = await searchMemory({ query: "plain", vault: "global" }, fixture.context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      semantic: {
        mode: "fused",
        problems: ["global: 8 notes are not embedded yet, so semantic results may be incomplete"],
      },
      vaults: [{ warnings: [expect.stringContaining("32 of 40")] }],
    },
  })
})

test("without a semantic source the search is text only and silent about it", async () => {
  const fixture = await conceptVault()

  const result = await searchMemory({ query: "automobile", vault: "global" }, fixture.plainContext)

  expect(result).toMatchObject({ output: { semantic: { mode: "text-only", problems: [] } } })
  expect(fixture.embedder.queries).toEqual([])
})

test("after a provider switch that could not re-embed, words still answer and every note is reported as not embedded", async () => {
  const fixture = await conceptVault()
  await putCatalogFile(fixture.vault, "Garage.md", noteWithId(3, "The automobile stays in the garage.", []))
  await searchMemory({ query: "automobile", vault: "global" }, fixture.context)
  const openai = { provider: "openai", model: "text-embedding-3-small" }
  await writeRegistrationSnapshot(fixture.context, JSON.stringify({ ...fixture.config, embeddings: openai }))
  fixture.embedder.dimensions.set("openai", 3)
  fixture.embedder.failFrom = { batch: 1, status: "unavailable" }
  const switched = { ...inFreshSession(fixture.context), semantic: fixture.embedder.source }

  const result = await searchMemory({ query: "automobile", vault: "global" }, switched)

  expect(searchedHits(result, "global").map((hit) => hit.path)).toEqual(["Garage.md"])
  expect(result).toMatchObject({
    output: { semantic: { problems: ["global: 3 notes are not embedded yet, so semantic results may be incomplete"] } },
  })
})

import { expect, test } from "vitest"

import { fuseSearchHits, synchronizeMemory } from "#src/usecases"
import { noteWithId, putCatalogFile, rankedFor, rankedWithQuery, semanticFixture } from "#test-helpers"

test("a paraphrase that shares no words with a note ranks that note first", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "vehicles/Car.md", noteWithId(1, "An engine on four wheels.", []))
  await putCatalogFile(fixture.vault, "pets/Dog.md", noteWithId(2, "A canine that barks.", []))
  await synchronizeMemory({ vault: "global" }, fixture.context)

  const ranked = await rankedFor(fixture, "automobile")

  expect(ranked.paths).toEqual(["vehicles/Car.md"])
  expect(ranked.hits).toMatchObject([{ path: "vehicles/Car.md", type: "rule", dontForget: false, needsFixing: false }])
})

test("notes below the provider's minimum similarity are left out, and archived notes never appear", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "Dog.md", noteWithId(2, "A puppy.", []))
  await putCatalogFile(fixture.vault, "archive/Car.md", noteWithId(3, "An automobile.", ["archived: 2026-10-01"]))
  await synchronizeMemory({ vault: "global" }, fixture.context)

  const ranked = await rankedFor(fixture, "automobile")

  expect(ranked.paths).toEqual([])
})

test("no vectors yet means no semantic ranking and no problem", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "Car.md", noteWithId(1, "An automobile.", []))

  const ranked = await rankedFor(fixture, "automobile")

  expect(ranked).toEqual({ paths: [], hits: [], problems: [] })
})

test("fusion puts a note found by both rankings first, then the rest by reciprocal rank", () => {
  const base = {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    type: "rule",
    dontForget: false,
    needsFixing: false,
    score: 0,
  } as const
  const text = [
    { ...base, path: "a.md", statement: "a" },
    { ...base, path: "b.md", statement: "b" },
  ]
  const semantic = {
    paths: ["c.md", "b.md"],
    hits: [
      { ...base, path: "c.md", statement: "c" },
      { ...base, path: "b.md", statement: "b" },
    ],
    problems: [],
  }

  const fused = fuseSearchHits(text, semantic, 10)

  expect(fused.map((entry) => entry.path)).toEqual(["b.md", "a.md", "c.md"])
  expect(fused[0]?.score).toBeCloseTo(1 / 62 + 1 / 62 + 0, 5)
})

test("fusion keeps only as many as the limit", () => {
  const base = {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    type: "rule",
    dontForget: false,
    needsFixing: false,
    score: 0,
  } as const
  const text = [{ ...base, path: "a.md", statement: "a" }]
  const semantic = { paths: ["b.md"], hits: [{ ...base, path: "b.md", statement: "b" }], problems: [] }

  expect(fuseSearchHits(text, semantic, 1)).toHaveLength(1)
})

test("vectors stored for another provider are never compared with the query, even with another dimension", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "vehicles/Car.md", noteWithId(1, "An engine on four wheels.", []))
  await synchronizeMemory({ vault: "global" }, fixture.context)

  const ranked = await rankedWithQuery(fixture, { fingerprint: "another-provider", vector: [1, 0, 0] })

  expect(ranked).toEqual({ paths: [], hits: [], problems: [] })
})

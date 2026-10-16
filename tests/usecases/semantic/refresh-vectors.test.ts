import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#src/usecases"
import {
  inFreshSession,
  moveNote,
  noteWithId,
  putCatalogFile,
  putConceptNotes,
  semanticFixture,
  vectorState,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("the first sync embeds every note in batches of at most 32 and covers them all", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 40)

  const result = await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(result).toMatchObject({ succeeded: true, output: { warnings: [] } })
  expect(fixture.embedder.documents.map((batch) => batch.length)).toEqual([32, 8])
  const state = await vectorState(fixture.context, fixture.vault.path)
  expect(state.coverage).toMatchObject({ embedded: 40, current: 40 })
})

test("each note is embedded as its statement and body, nothing else", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "Car.md", noteWithId(1, "An automobile.", []))

  await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(fixture.embedder.documents).toEqual([["Car\n\nAn automobile."]])
})

test("a move or a date-only change makes no embed call", async () => {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "old/Car.md", noteWithId(1, "An automobile.", []))
  await synchronizeMemory({ vault: "global" }, fixture.context)
  const calls = fixture.embedder.documents.length

  await moveNote(fixture.vault.path, "old/Car.md", "Car.md")
  const text = await readFile(join(fixture.vault.path, "Car.md"), "utf8")
  await putCatalogFile(fixture.vault, "Car.md", text.replace("updated: 2026-10-04", "updated: 2026-11-30"))
  await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(fixture.embedder.documents).toHaveLength(calls)
  expect((await vectorState(fixture.context, fixture.vault.path)).coverage).toMatchObject({ embedded: 1, current: 1 })
})

test("a body edit embeds exactly that one note again", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 3)
  await synchronizeMemory({ vault: "global" }, fixture.context)

  await putCatalogFile(fixture.vault, "notes/Note 2.md", noteWithId(2, "A puppy now.", []))
  await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(fixture.embedder.documents.slice(1)).toEqual([["Note 2\n\nA puppy now."]])
})

test("the vector of a deleted note is dropped", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 3)
  await synchronizeMemory({ vault: "global" }, fixture.context)

  await moveNote(fixture.vault.path, "notes/Note 3.md", "Gone.txt")
  await synchronizeMemory({ vault: "global" }, fixture.context)

  const state = await vectorState(fixture.context, fixture.vault.path)
  expect(state.chunks).toBe(2)
  expect(state.coverage).toMatchObject({ embedded: 2, current: 2 })
})

test("switching the provider re-embeds every note and the vectors belong to the new provider", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 3)
  await synchronizeMemory({ vault: "global" }, fixture.context)
  const before = (await vectorState(fixture.context, fixture.vault.path)).generation
  const openai = { provider: "openai", model: "text-embedding-3-small" }
  await writeRegistrationSnapshot(fixture.context, JSON.stringify({ ...fixture.config, embeddings: openai }))
  const switched = { ...inFreshSession(fixture.context), semantic: fixture.embedder.source }

  await synchronizeMemory({ vault: "global" }, switched)

  expect(fixture.embedder.documents.map((batch) => batch.length)).toEqual([3, 3])
  const after = (await vectorState(switched, fixture.vault.path)).generation
  expect(after?.fingerprint).not.toBe(before?.fingerprint)
  expect(after?.fingerprint).toContain("openai")
})

test("an interrupted embedding keeps its progress and the next sync embeds only the rest", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 40)
  fixture.embedder.failFrom = { batch: 2, status: "unavailable" }

  const first = await synchronizeMemory({ vault: "global" }, fixture.context)
  const partial = await vectorState(fixture.context, fixture.vault.path)
  fixture.embedder.failFrom = null
  await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(first).toMatchObject({
    succeeded: true,
    output: { warnings: ["Embedding stopped (unavailable); 32 of 40 notes were embedded before it stopped"] },
  })
  expect(partial.coverage).toMatchObject({ embedded: 32, current: 40 })
  expect(fixture.embedder.documents.map((batch) => batch.length)).toEqual([32, 8, 8])
  expect((await vectorState(fixture.context, fixture.vault.path)).coverage).toMatchObject({ embedded: 40, current: 40 })
})

test("an unavailable embedder says why, embeds nothing and leaves the text index working", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 2)
  const off = { ...fixture.context, semantic: async () => ({ available: false as const, reason: "no credentials" }) }

  const result = await synchronizeMemory({ vault: "global" }, off)

  expect(result).toMatchObject({
    succeeded: true,
    output: { warnings: ["Semantic search is off: no credentials"], coverage: "complete" },
  })
  expect(fixture.embedder.documents).toEqual([])
})

test("without a semantic source nothing is embedded and nothing is said", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 2)

  const result = await synchronizeMemory({ vault: "global" }, fixture.plainContext)

  expect(result).toMatchObject({ succeeded: true, output: { warnings: [] } })
  expect(fixture.embedder.documents).toEqual([])
})

test("vectors that claim to belong to another provider are refused and nothing is stored", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 2)
  fixture.embedder.fingerprintOverride = "another-provider"

  const result = await synchronizeMemory({ vault: "global" }, fixture.context)

  expect(result).toMatchObject({
    succeeded: true,
    output: { warnings: ["The embedder produced vectors for another provider; they were not stored"] },
  })
  expect((await vectorState(fixture.context, fixture.vault.path)).chunks).toBe(0)
})

test("an interruption between batches stops embedding and keeps the finished batch", async () => {
  const fixture = await semanticFixture()
  await putConceptNotes(fixture, 40)
  const controller = new AbortController()
  fixture.embedder.afterDocuments = () => controller.abort()

  await synchronizeMemory({ vault: "global" }, { ...fixture.context, signal: controller.signal })

  expect(fixture.embedder.documents.map((batch) => batch.length)).toEqual([32])
  expect((await vectorState(fixture.context, fixture.vault.path)).coverage).toMatchObject({ embedded: 32, current: 40 })
})

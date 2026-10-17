import { expect, test, vi } from "vitest"

import { prepareSemanticSearch, semanticPortOf } from "#src/usecases"
import { fakeEmbedder, resolvedFixture } from "#test-helpers"

test("without a semantic source there is no port", async () => {
  const { context, memory } = await resolvedFixture()

  expect(await semanticPortOf(context, memory)).toBeNull()
})

test("the source is asked for the configured embeddings", async () => {
  const { context, memory } = await resolvedFixture()
  const source = vi.fn(fakeEmbedder().source)

  const port = await semanticPortOf({ ...context, semantic: source }, memory)

  expect(source).toHaveBeenCalledWith({ provider: "local", model: "Xenova/multilingual-e5-small" })
  expect(port).toMatchObject({ available: true })
})

test("no port means no query vector and nothing to say", async () => {
  const { context } = await resolvedFixture()

  expect(await prepareSemanticSearch(null, "car", context)).toEqual({ query: null, problems: [] })
})

test("an unavailable port says why semantic search is off", async () => {
  const { context } = await resolvedFixture()

  const prepared = await prepareSemanticSearch({ available: false, reason: "declined" }, "car", context)

  expect(prepared).toEqual({ query: null, problems: ["Semantic search is off: declined"] })
})

test("the query is embedded as a query and keeps the provider fingerprint", async () => {
  const { context, memory } = await resolvedFixture()
  const embedder = fakeEmbedder()
  const port = await embedder.source(memory.config.embeddings)

  const prepared = await prepareSemanticSearch(port, "automobile", context)

  expect(embedder.queries).toEqual(["automobile"])
  expect(prepared.problems).toEqual([])
  expect(prepared.query?.fingerprint).toContain("local")
  expect(prepared.query?.vector).toHaveLength(5)
})

test("a query that cannot be embedded says results use words only", async () => {
  const { context } = await resolvedFixture()
  const failing = {
    available: true as const,
    embed: async () => ({ succeeded: false as const, status: "unavailable" as const }),
  }

  const prepared = await prepareSemanticSearch(failing, "car", context)

  expect(prepared.query).toBeNull()
  expect(prepared.problems).toEqual([
    "Semantic search is off: the query could not be embedded, so results use words only",
  ])
})

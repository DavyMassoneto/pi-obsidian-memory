import { expect, test } from "vitest"

import { prepareSemanticSearch, semanticPortOf } from "#src/usecases"
import { resolvedFixture } from "#test-helpers"

test("without a semantic source there is no port", async () => {
  const { context, memory } = await resolvedFixture()

  expect(await semanticPortOf(context, memory)).toBeNull()
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

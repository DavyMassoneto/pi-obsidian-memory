import { expect, test } from "vitest"

import { cosine, MINIMUM_SIMILARITY } from "#src/services"
import { benchmarkQueries, embedBenchmark, rankedIndexes } from "#test-helpers"

test("the real local model finds paraphrased notes and keeps recall at the minimum similarity", async () => {
  const { documents, queries: queryVectors } = await embedBenchmark()

  const threshold = MINIMUM_SIMILARITY.local
  let paraphraseRecall = 0
  let paraphrases = 0
  let relevantPairs = 0
  let relevantKept = 0
  for (const [index, item] of benchmarkQueries.entries()) {
    const queryVector = queryVectors[index]
    if (!queryVector) throw new Error(`missing query vector ${index}`)
    const similarities = documents.map((document) => cosine(queryVector, document))
    for (const note of item.rel) {
      relevantPairs++
      const similarity = similarities[note]
      if (typeof similarity === "number" && similarity >= threshold) relevantKept++
    }
    if (item.paraphrase && item.rel.length > 0) {
      const top = rankedIndexes(similarities).slice(0, 5)
      paraphraseRecall += item.rel.filter((note) => top.includes(note)).length / item.rel.length
      paraphrases++
    }
  }

  expect(paraphrases).toBe(10)
  expect(paraphraseRecall / paraphrases).toBeGreaterThanOrEqual(0.9)
  expect(relevantKept / relevantPairs).toBeGreaterThanOrEqual(0.9)
}, 1_800_000)

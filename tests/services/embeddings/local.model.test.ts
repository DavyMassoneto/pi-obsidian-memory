import { expect, test } from "vitest"

import { cosine, MINIMUM_SIMILARITY } from "#src/services"
import {
  benchmarkCacheFolder,
  benchmarkQueries,
  collectedHeapMiB,
  embedBenchmark,
  embeddingOperation,
  loadEmbedderFactory,
  observeRealExtraction,
  queuedLocalInferences,
  rankedIndexes,
} from "#test-helpers"

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

const request = { purpose: "query", inputs: [{ key: "a", text: "qual é a capital do Brasil?" }] } as const

test("shares one real model across independent evaluations and releases it after disposal", async () => {
  const firstFactory = await loadEmbedderFactory()
  const secondFactory = await loadEmbedderFactory()
  expect(secondFactory).not.toBe(firstFactory)

  const options = { cachePath: benchmarkCacheFolder() }
  const single = firstFactory(options)
  const first = firstFactory(options)
  const second = secondFactory(options)
  const third = secondFactory(options)
  const reloaded = secondFactory(options)
  const context = embeddingOperation()
  try {
    const baseline = collectedHeapMiB()
    const reference = await single.embed(context, request)
    if (!reference.succeeded) throw new Error(`Reference inference failed: ${reference.status}`)
    const vector = reference.output.items[0]?.vector
    if (!vector) throw new Error("Reference inference returned no vector")
    expect(vector).toHaveLength(384)
    expect(Math.hypot(...vector)).toBeCloseTo(1)
    const oneModel = collectedHeapMiB()
    await single.dispose()
    const idle = collectedHeapMiB()

    const cancel = new AbortController()
    const firstRun = first.embed(context, request)
    const cancelled = first.embed({ signal: cancel.signal }, request)
    const secondRun = second.embed(context, request)
    const thirdRun = third.embed(context, request)
    expect(queuedLocalInferences(options.cachePath)).toBe(3)
    cancel.abort()
    expect(queuedLocalInferences(options.cachePath)).toBe(2)
    expect(await cancelled).toEqual({ succeeded: false, status: "aborted" })
    expect(await Promise.all([firstRun, secondRun, thirdRun])).toEqual([reference, reference, reference])
    const threeEmbedders = collectedHeapMiB()

    const closing = first.dispose()
    const remaining = second.embed(context, request)
    await closing
    expect(await first.embed(context, request)).toEqual({ succeeded: false, status: "unavailable" })
    expect(await remaining).toEqual(reference)
    await second.dispose()

    await third.dispose()
    const released = collectedHeapMiB()

    expect(await reloaded.embed(context, request)).toEqual(reference)
    const reopened = collectedHeapMiB()
    await reloaded.dispose()
    const releasedAgain = collectedHeapMiB()
    console.info({ baseline, oneModel, idle, threeEmbedders, released, reopened, releasedAgain })

    const modelGrowth = oneModel - idle
    expect(modelGrowth).toBeGreaterThan(100)
    expect(threeEmbedders - idle).toBeGreaterThan(modelGrowth * 0.75)
    expect(threeEmbedders - idle).toBeLessThan(modelGrowth * 1.35)
    expect(released - idle).toBeLessThan(modelGrowth * 0.25)
    expect(reopened - released).toBeGreaterThan(modelGrowth * 0.75)
    expect(releasedAgain - idle).toBeLessThan(modelGrowth * 0.25)
  } finally {
    await Promise.all([single, first, second, third, reloaded].map((embedder) => embedder.dispose()))
  }
})

test("last disposal does not release the real ONNX session during extraction", async () => {
  const { embedder, started, disposalOrder } = observeRealExtraction(benchmarkCacheFolder())
  try {
    const inference = embedder.embed(embeddingOperation(), request)
    const [disposal] = await started
    await disposal
    expect(disposalOrder).toEqual(["extracted", "disposed"])
    expect(await inference).toMatchObject({ succeeded: true })
  } finally {
    await embedder.dispose()
  }
})

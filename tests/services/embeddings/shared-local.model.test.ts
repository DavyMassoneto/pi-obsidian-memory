import { setImmediate } from "node:timers/promises"

import { expect, test } from "vitest"

import { benchmarkCacheFolder, collectedHeapMiB, embeddingOperation, loadEmbedderFactory } from "#test-helpers"

const request = { purpose: "query", inputs: [{ key: "a", text: "qual é a capital do Brasil?" }] } as const

test("shares one real model across independent evaluations and releases it after the last inference", async () => {
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
    const cancelled = first.embed({ signal: cancel.signal }, request)
    const firstRun = first.embed(context, request)
    const secondRun = second.embed(context, request)
    const thirdRun = third.embed(context, request)
    await setImmediate()
    cancel.abort()
    expect(await cancelled).toEqual({ succeeded: false, status: "aborted" })
    expect(await Promise.all([firstRun, secondRun, thirdRun])).toEqual([reference, reference, reference])
    const threeEmbedders = collectedHeapMiB()

    const closing = first.dispose()
    const remaining = second.embed(context, request)
    await closing
    expect(await first.embed(context, request)).toEqual({ succeeded: false, status: "unavailable" })
    expect(await remaining).toEqual(reference)
    await second.dispose()

    const lastInference = third.embed(context, request)
    await setImmediate()
    await third.dispose()
    expect(await lastInference).toEqual(reference)
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

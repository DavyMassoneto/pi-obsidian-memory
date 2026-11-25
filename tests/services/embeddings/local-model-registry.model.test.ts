import { setImmediate } from "node:timers/promises"

import { expect, test } from "vitest"

import { createLocalEmbedder } from "#src/services"
import { benchmarkCacheFolder, collectAbandonedEmbedder, collectedHeapMiB, embeddingOperation } from "#test-helpers"

const request = { purpose: "query", inputs: [{ key: "a", text: "qual é a capital do Brasil?" }] } as const

test("an unreachable embedder does not prevent the final live owner from releasing the real model", async () => {
  const options = { cachePath: benchmarkCacheFolder() }
  const live = createLocalEmbedder(options)
  try {
    expect(await live.embed(embeddingOperation(), request)).toMatchObject({ succeeded: true })
    const abandoned = await collectAbandonedEmbedder(options, request)
    await setImmediate()
    const loaded = collectedHeapMiB()
    expect(abandoned.deref()).toBeUndefined()
    await live.dispose()
    const released = collectedHeapMiB()
    console.info({ loadedWithAbandonedOwner: loaded, releasedAfterLiveOwner: released })
    expect(loaded - released).toBeGreaterThan(100)
  } finally {
    await live.dispose()
  }
})

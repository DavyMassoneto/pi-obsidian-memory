import { expect, test } from "vitest"

import { createLocalEmbedder, localModelRegistryKey } from "#src/services"
import { embeddingOperation, useTempFolder } from "#test-helpers"

test("invalid process registry entries are refused and evicted without mutating them", async () => {
  const cachePath = await useTempFolder()
  const malformed = Object.freeze({})
  const registry = new Map([[cachePath, malformed]])
  Object.defineProperty(globalThis, localModelRegistryKey, { value: registry, configurable: true })
  const embedder = createLocalEmbedder({ cachePath })
  try {
    const request = { purpose: "query", inputs: [{ key: "a", text: "hello" }] } as const
    expect(await embedder.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
    expect(registry.has(cachePath)).toBe(false)
    expect(malformed).toEqual({})
  } finally {
    await embedder.dispose()
    Reflect.deleteProperty(globalThis, localModelRegistryKey)
  }
})

test("a foreign global accessor is refused without calling it and does not poison later sessions", async () => {
  const cachePath = await useTempFolder()
  let accessed = false
  Object.defineProperty(globalThis, localModelRegistryKey, {
    configurable: true,
    get() {
      accessed = true
      throw new Error("Foreign registry accessor was invoked")
    },
  })
  const embedder = createLocalEmbedder({ cachePath })
  try {
    const request = { purpose: "query", inputs: [{ key: "a", text: "hello" }] } as const
    expect(await embedder.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
    expect(accessed).toBe(false)
    expect(Object.hasOwn(globalThis, localModelRegistryKey)).toBe(false)
  } finally {
    await embedder.dispose()
    Reflect.deleteProperty(globalThis, localModelRegistryKey)
  }
})

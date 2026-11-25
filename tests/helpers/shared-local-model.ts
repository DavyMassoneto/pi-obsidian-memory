import { resolve } from "node:path"
import { types } from "node:util"
import { setFlagsFromString } from "node:v8"
import { runInNewContext } from "node:vm"

import {
  createLocalEmbedder,
  type EmbeddingBatchRequest,
  type LocalEmbedder,
  type LocalEmbeddingOptions,
  loadLocalModel,
  localModelRegistryKey,
} from "#src/services"
import { embeddingOperation } from "./embeddings.ts"

export async function loadEmbedderFactory(): Promise<typeof createLocalEmbedder> {
  const { createJiti } = await import("jiti")
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false })
  const { createLocalEmbedder: factory } = await jiti.import<typeof import("../../src/services/embeddings/local.ts")>(
    "../../src/services/embeddings/local.ts",
  )
  return factory
}

export function collectedHeapMiB(): number {
  setFlagsFromString("--expose-gc")
  try {
    runInNewContext("gc()")
  } finally {
    setFlagsFromString("--no-expose-gc")
  }
  return process.memoryUsage().heapUsed / 1024 ** 2
}

export async function collectAbandonedEmbedder(
  options: LocalEmbeddingOptions,
  request: EmbeddingBatchRequest,
): Promise<WeakRef<LocalEmbedder>> {
  const embedder = createLocalEmbedder(options)
  const result = await embedder.embed(embeddingOperation(), request)
  if (!result.succeeded) throw new Error(result.status)
  return new WeakRef(embedder)
}

export function queuedLocalInferences(cachePath: string): number {
  const host: object = globalThis
  if (!(localModelRegistryKey in host) || !types.isMap(host[localModelRegistryKey])) {
    throw new Error("Real local model registry not found")
  }
  const entry = host[localModelRegistryKey].get(resolve(cachePath))
  if (!entry || typeof entry !== "object" || !("waiting" in entry) || !types.isSet(entry.waiting)) {
    throw new Error("Real local inference queue not found")
  }
  return entry.waiting.size
}

export function observeRealExtraction(cachePath: string) {
  const { promise: started, resolve: extractionStarted } = Promise.withResolvers<readonly [Promise<void>]>()
  const disposalOrder: string[] = []
  const embedder = createLocalEmbedder({
    cachePath,
    async loadModel(options) {
      const model = await loadLocalModel(options)
      return {
        countTokens: (text) => model.countTokens(text),
        async extract(text) {
          const extraction = model.extract(text).finally(() => disposalOrder.push("extracted"))
          extractionStarted([embedder.dispose()])
          return extraction
        },
        async dispose() {
          disposalOrder.push("disposed")
          await model.dispose()
        },
      }
    },
  })
  return { embedder, started, disposalOrder }
}

import { isAbsolute, resolve } from "node:path"

import { localModelRegistryKey } from "./constants.ts"
import type { LocalEmbeddingOptions, LocalModelLease, LocalModelRegistry, SharedLocalModel } from "./types.ts"

export function acquireLocalModel(options: LocalEmbeddingOptions): LocalModelLease {
  if (options.loadModel || !isAbsolute(options.cachePath)) return { entry: newEntry(Promise.resolve()), cacheKey: null }

  const cacheKey = resolve(options.cachePath)
  const registry = localModelRegistry()
  const previous = registry.get(cacheKey)
  if (previous && !previous.retirement) {
    previous.owners++
    return { entry: previous, cacheKey }
  }

  let beforeLoad = Promise.resolve()
  if (previous?.retirement) beforeLoad = previous.retirement.catch(() => {})
  const entry = newEntry(beforeLoad)
  registry.set(cacheKey, entry)
  return { entry, cacheKey }
}

export function releaseLocalModel(lease: LocalModelLease, settled: Promise<void>): Promise<void> {
  const { entry } = lease
  entry.owners--
  if (entry.owners > 0) return settled

  entry.retirement = entry.queue.then(() => retireLocalModel(lease))
  entry.loading?.abort()
  return entry.retirement
}

async function retireLocalModel({ entry, cacheKey }: LocalModelLease): Promise<void> {
  try {
    const pending = entry.model
    entry.model = null
    const result = await pending
    if (result?.succeeded) await result.output.dispose()
  } finally {
    if (cacheKey) {
      const registry = localModelRegistry()
      if (registry.get(cacheKey) === entry) registry.delete(cacheKey)
    }
  }
}

function newEntry(beforeLoad: Promise<void>): SharedLocalModel {
  return {
    owners: 1,
    loading: null,
    model: null,
    queue: Promise.resolve(),
    retirement: null,
    beforeLoad,
    interests: new Set(),
  }
}

function localModelRegistry(): LocalModelRegistry {
  const host: object = globalThis
  if (localModelRegistryKey in host) {
    const candidate = host[localModelRegistryKey]
    if (candidate && typeof candidate === "object" && isLocalModelRegistry(candidate)) return candidate
    throw new Error("Invalid process-wide local model registry")
  }
  const registry = new Map<string, SharedLocalModel>()
  Object.defineProperty(globalThis, localModelRegistryKey, { value: registry })
  return registry
}

function isLocalModelRegistry(candidate: object): candidate is LocalModelRegistry {
  return (
    "get" in candidate &&
    typeof candidate.get === "function" &&
    "set" in candidate &&
    typeof candidate.set === "function" &&
    "delete" in candidate &&
    typeof candidate.delete === "function"
  )
}

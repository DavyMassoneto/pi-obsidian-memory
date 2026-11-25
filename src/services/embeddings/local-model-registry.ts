import { isAbsolute, resolve } from "node:path"
import { types } from "node:util"

import { localModelRegistryKey, localModelRegistryRecoveryKey } from "./constants.ts"
import { isSharedLocalModel, unmodifiedCollection } from "./local-model-shape.ts"
import type { LocalEmbeddingState, LocalModelLease, SharedLocalModel } from "./types.ts"

export function acquireLocalModel(state: LocalEmbeddingState): LocalModelLease {
  const owner = state.owner
  const embedder = owner?.deref()
  if (!owner || !embedder) throw new Error("Local embedder no longer exists")
  const { cachePath, loadModel } = state.options
  if (loadModel || !isAbsolute(cachePath)) {
    const entry = newEntry(Promise.resolve())
    entry.owners.set(owner, state.lifetime)
    return { entry, owner, lifetime: state.lifetime, cacheKey: null }
  }

  const cacheKey = resolve(cachePath)
  const entry = sharedEntry(cacheKey)
  const lease = { entry, owner, lifetime: state.lifetime, cacheKey }
  entry.owners.set(owner, state.lifetime)
  entry.finalizer.register(embedder, lease, owner)
  return lease
}

function sharedEntry(cacheKey: string): SharedLocalModel {
  const registry = localModelRegistry()
  let beforeLoad = Promise.resolve()
  if (registry.has(cacheKey)) {
    const previous = registry.get(cacheKey)
    if (!previous || typeof previous !== "object" || !isSharedLocalModel(previous)) {
      registry.delete(cacheKey)
      throw new Error("Invalid process-wide local model entry")
    }
    if (!previous.retirement) return previous
    beforeLoad = previous.retirement.catch(() => {})
  }
  const entry = newEntry(beforeLoad)
  registry.set(cacheKey, entry)
  return entry
}

export function releaseLocalModel(lease: LocalModelLease, settled: Promise<void>): Promise<void> {
  const { entry, lifetime, owner } = lease
  if (!entry.owners.delete(owner)) return settled
  entry.finalizer.unregister(owner)
  lifetime.abort()
  for (const [candidate, abandoned] of entry.owners) {
    if (candidate.deref()) continue
    entry.owners.delete(candidate)
    entry.finalizer.unregister(candidate)
    abandoned.abort()
  }
  if (entry.owners.size > 0) return settled

  entry.retirement = retireLocalModel(lease)
  entry.loading?.abort()
  return entry.retirement
}

async function retireLocalModel({ entry, cacheKey }: LocalModelLease): Promise<void> {
  try {
    await entry.running
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
    owners: new Map(),
    finalizer: new FinalizationRegistry(finalizeLease),
    loading: null,
    model: null,
    waiting: new Set(),
    running: null,
    retirement: null,
    beforeLoad,
    interests: new Set(),
  }
}

function finalizeLease(lease: LocalModelLease): void {
  void releaseLocalModel(lease, Promise.resolve()).catch(() => {})
}

function localModelRegistry() {
  const host: object = globalThis
  const recovery = recoveryRegistry(host)
  if (recovery) return recovery
  if (localModelRegistryKey in host && Object.hasOwn(host, localModelRegistryKey)) {
    if (hasDataSlot(host, localModelRegistryKey)) {
      const candidate = host[localModelRegistryKey]
      if (types.isMap(candidate) && unmodifiedCollection(candidate, Map.prototype)) return candidate
    }
    if (!Reflect.deleteProperty(host, localModelRegistryKey)) {
      Object.defineProperty(host, localModelRegistryRecoveryKey, { value: new Map<string, SharedLocalModel>() })
    }
    throw new Error("Invalid process-wide local model registry")
  }
  const registry = new Map<string, SharedLocalModel>()
  Object.defineProperty(host, localModelRegistryKey, { value: registry, configurable: true })
  return registry
}

function recoveryRegistry(host: object) {
  if (localModelRegistryRecoveryKey in host && Object.hasOwn(host, localModelRegistryRecoveryKey)) {
    if (hasDataSlot(host, localModelRegistryRecoveryKey)) {
      const recovery = host[localModelRegistryRecoveryKey]
      if (types.isMap(recovery) && unmodifiedCollection(recovery, Map.prototype)) return recovery
    }
    Reflect.deleteProperty(host, localModelRegistryRecoveryKey)
    throw new Error("Invalid process-wide local model recovery registry")
  }
  return null
}

function hasDataSlot(host: object, key: symbol): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(host, key)
  if (!descriptor) return false
  return Object.hasOwn(descriptor, "value")
}

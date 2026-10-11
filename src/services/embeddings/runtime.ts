import { EmbeddingResourceError } from "./errors.ts"
import { loadCachedLocalModel } from "./inference.ts"
import { provisionLocalModel } from "./model-cache.ts"
import type { LocalModel, LocalModelOptions } from "./types.ts"

export async function loadLocalModel(options: LocalModelOptions): Promise<LocalModel> {
  const cache = await provisionLocalModel(options)
  if (!cache.succeeded) {
    throw new EmbeddingResourceError(cache)
  }
  options.signal.throwIfAborted()
  return loadCachedLocalModel(cache.output)
}

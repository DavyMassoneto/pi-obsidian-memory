import { isAbsolute, join } from "node:path"

import { localEmbeddingConfiguration, localEmbeddingPolicy } from "#src/domain"
import { fetchPublicModelAsset } from "./asset-fetch.ts"
import { localModelAssets } from "./constants.ts"
import { provisionModelAsset } from "./model-asset.ts"
import type { LocalModelOptions, ModelAssetRequest, ModelCacheResult } from "./types.ts"

export async function provisionLocalModel(options: LocalModelOptions): Promise<ModelCacheResult> {
  if (!isAbsolute(options.cachePath)) {
    return { succeeded: false, status: "unavailable" }
  }
  const directory = join(options.cachePath, localEmbeddingConfiguration.model, localEmbeddingPolicy.revision)
  for (const asset of localModelAssets) {
    const request: ModelAssetRequest = {
      directory,
      asset,
      signal: options.signal,
      transport: fetchPublicModelAsset,
    }
    if (options.onProgress) {
      request.onProgress = options.onProgress
    }
    const result = await provisionModelAsset(request)
    if (!result.succeeded) {
      return result
    }
  }
  return { succeeded: true, output: directory }
}

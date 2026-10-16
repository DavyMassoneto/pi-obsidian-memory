import { join } from "node:path"

import {
  createLocalEmbedder,
  embeddingPolicy,
  inspectModelAsset,
  localEmbeddingConfiguration,
  localModelAssets,
} from "#src/services"
import type { LocalModelStatus, LocalSemantic, LocalSemanticOptions } from "./types.ts"

export function createLocalSemantic(options: LocalSemanticOptions): LocalSemantic {
  const embedder = createLocalEmbedder({ cachePath: options.cachePath })
  return {
    port: { available: true, embed: (request, context) => embedder.embed(context, request) },
    dispose: () => embedder.dispose(),
  }
}

export async function checkLocalModel(cachePath: string, signal: AbortSignal): Promise<LocalModelStatus> {
  const directory = join(
    cachePath,
    localEmbeddingConfiguration.model,
    embeddingPolicy(localEmbeddingConfiguration).revision,
  )
  let status: LocalModelStatus = "cached"
  for (const asset of localModelAssets) {
    const inspected = await inspectModelAsset(join(directory, asset.path), asset, signal)
    if (inspected === "invalid") return "invalid"
    if (inspected === "missing") status = "missing"
  }
  return status
}

import type { FeatureExtractionPipeline } from "@huggingface/transformers"

import type { LocalModel } from "./types.ts"

export async function loadCachedLocalModel(modelPath: string): Promise<LocalModel> {
  const { pipeline } = await import("@huggingface/transformers")
  const extractor = await pipeline("feature-extraction", modelPath, {
    device: "cpu",
    dtype: "q8",
    local_files_only: true,
    cache_dir: modelPath,
  })
  return localModelFromPipeline(extractor)
}

function localModelFromPipeline(extractor: FeatureExtractionPipeline): LocalModel {
  return {
    countTokens(text) {
      return extractor.tokenizer.encode(text, { add_special_tokens: true }).length
    },
    async extract(text) {
      const tensor = await extractor(text, { pooling: "mean", normalize: true })
      if (tensor.dims.length !== 2 || tensor.dims[0] !== 1 || tensor.dims[1] !== 384) {
        return null
      }
      if (!(tensor.data instanceof Float32Array)) {
        return null
      }
      return Array.from(tensor.data)
    },
    async dispose() {
      await extractor.dispose()
    },
  }
}

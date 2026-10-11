import { googleEmbeddingPolicy, localEmbeddingPolicy, openAIEmbeddingPolicy } from "./constants.ts"
import type { EmbeddingConfiguration, EmbeddingPolicy } from "./types.ts"

export function embeddingPolicy(configuration: EmbeddingConfiguration): EmbeddingPolicy {
  switch (configuration.provider) {
    case "local":
      return localEmbeddingPolicy
    case "openai":
      return openAIEmbeddingPolicy
    case "google":
      return googleEmbeddingPolicy
  }
}

export function embeddingFingerprint(configuration: EmbeddingConfiguration): string {
  const policy = embeddingPolicy(configuration)
  return JSON.stringify([
    "embeddings-v1",
    configuration.provider,
    configuration.model,
    policy.revision,
    policy.dimensions,
    policy.dtype,
    policy.pooling,
    policy.normalization,
    policy.queryPrefix,
    policy.documentPrefix,
    policy.chunking,
  ])
}

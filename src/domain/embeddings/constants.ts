import type { EmbeddingConfiguration, EmbeddingPolicy, MinimumSimilarities } from "./types.ts"

export const localEmbeddingConfiguration = {
  provider: "local",
  model: "Xenova/multilingual-e5-small",
} as const satisfies EmbeddingConfiguration

export const openAIEmbeddingConfiguration = {
  provider: "openai",
  model: "text-embedding-3-small",
} as const satisfies EmbeddingConfiguration

export const googleEmbeddingConfiguration = {
  provider: "google",
  model: "gemini-embedding-001",
} as const satisfies EmbeddingConfiguration

export const localEmbeddingPolicy = {
  revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  dimensions: 384,
  dtype: "cpu-q8-transformers-4.3.1",
  pooling: "mean",
  normalization: "l2",
  queryPrefix: "query: ",
  documentPrefix: "passage: ",
  chunking: "v1-token-aware-512-special-prefix-inclusive-overlap32-mean-chunks-query-refuse",
} as const satisfies EmbeddingPolicy

export const openAIEmbeddingPolicy = {
  revision: "provider-managed",
  dimensions: 1536,
  dtype: "float",
  pooling: "provider",
  normalization: "l2",
  queryPrefix: "",
  documentPrefix: "",
  chunking: "v1-utf8-bytes4096-overlap128-mean-chunks-query-refuse",
} as const satisfies EmbeddingPolicy

export const googleEmbeddingPolicy = {
  revision: "provider-managed",
  dimensions: 768,
  dtype: "float",
  pooling: "provider",
  normalization: "l2",
  queryPrefix: "RETRIEVAL_QUERY",
  documentPrefix: "RETRIEVAL_DOCUMENT",
  chunking: "v1-utf8-bytes1024-overlap128-mean-chunks-query-refuse-autoTruncate-false",
} as const satisfies EmbeddingPolicy

export const MINIMUM_SIMILARITY = {
  local: 0.8,
  openai: null,
  google: null,
} as const satisfies MinimumSimilarities

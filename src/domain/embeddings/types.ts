import type { Static } from "typebox"

import type { Succeeded } from "#src/shared"
import type { EmbeddingConfigurationSchema } from "./schemas.ts"

export type EmbeddingConfiguration = Static<typeof EmbeddingConfigurationSchema>

export interface EmbeddingInput {
  key: string
  text: string
}

export interface EmbeddingBatchRequest {
  purpose: "query" | "document"
  inputs: readonly EmbeddingInput[]
}

export interface EmbeddedInput {
  key: string
  vector: readonly number[]
}

export interface EmbeddingBatch {
  fingerprint: string
  dimensions: number
  items: readonly EmbeddedInput[]
}

export type EmbeddingFailureStatus =
  | "unavailable"
  | "input-too-long"
  | "invalid-input"
  | "invalid-response"
  | "aborted"
  | "deadline"

export interface EmbeddingFailure {
  succeeded: false
  status: EmbeddingFailureStatus
  cleanupFailed?: true
}

export type EmbeddingResult = Succeeded<EmbeddingBatch> | EmbeddingFailure

export interface EmbeddingPolicy {
  revision: string
  dimensions: number
  dtype: string
  pooling: string
  normalization: "l2"
  queryPrefix: string
  documentPrefix: string
  chunking: string
}

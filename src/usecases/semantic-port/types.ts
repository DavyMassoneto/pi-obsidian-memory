import type {
  EmbeddingBatchRequest,
  EmbeddingConfiguration,
  EmbeddingOperationContext,
  EmbeddingResult,
} from "#src/services"

export interface SemanticAvailable {
  available: true
  embed(request: EmbeddingBatchRequest, context: EmbeddingOperationContext): Promise<EmbeddingResult>
}

export interface SemanticUnavailable {
  available: false
  reason: string
}

export type SemanticPort = SemanticAvailable | SemanticUnavailable

export type SemanticSource = (configuration: EmbeddingConfiguration) => Promise<SemanticPort>

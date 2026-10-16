import type { EmbeddingFailure } from "#src/domain"

export class EmbeddingResourceError extends Error {
  readonly failure: EmbeddingFailure

  constructor(failure: EmbeddingFailure) {
    super("Embedding resource unavailable")
    this.name = "EmbeddingResourceError"
    this.failure = failure
  }
}

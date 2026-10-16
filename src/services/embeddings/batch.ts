import {
  aggregateVectors,
  type EmbeddedInput,
  type EmbeddingBatchRequest,
  type EmbeddingConfiguration,
  type EmbeddingResult,
  embeddingFingerprint,
  embeddingPolicy,
} from "#src/domain"
import type { PreparedChunk } from "./types.ts"

export function finishEmbeddingBatch(
  configuration: EmbeddingConfiguration,
  request: EmbeddingBatchRequest,
  chunks: readonly PreparedChunk[],
  vectors: readonly (readonly number[])[],
): EmbeddingResult {
  if (chunks.length !== vectors.length) {
    return { succeeded: false, status: "invalid-response" }
  }
  const dimensions = embeddingPolicy(configuration).dimensions
  const items: EmbeddedInput[] = []
  for (const [index, input] of request.inputs.entries()) {
    const matching = vectors.filter((_vector, position) => chunks[position]?.inputIndex === index)
    const vector = aggregateVectors(matching, dimensions)
    if (!vector) {
      return { succeeded: false, status: "invalid-response" }
    }
    items.push({ key: input.key, vector })
  }
  return { succeeded: true, output: { fingerprint: embeddingFingerprint(configuration), dimensions, items } }
}

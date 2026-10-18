import { createHash } from "node:crypto"

import type { EmbeddingOperationContext, ModelAsset } from "#src/services"

export function embeddingOperation(): EmbeddingOperationContext {
  return { signal: new AbortController().signal }
}

export function embeddingVector(dimensions: number, position?: number): number[] {
  const vector = Array<number>(dimensions).fill(0)
  let index = 0
  if (typeof position === "number") {
    index = position
  }
  vector[index] = 2
  return vector
}

export function openAIResponse(indices: readonly number[]): string {
  return JSON.stringify({
    object: "list",
    model: "text-embedding-3-small",
    data: indices.map((index) => ({ object: "embedding", index, embedding: embeddingVector(1536, index) })),
    usage: { prompt_tokens: 3, total_tokens: 3 },
  })
}

export function syntheticModelAsset(text: string): ModelAsset {
  return {
    path: "config.json",
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
  }
}

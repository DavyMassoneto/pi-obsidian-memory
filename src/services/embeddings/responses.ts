import { Value } from "typebox/value"

import { normalizeVector } from "#src/domain"
import { GoogleEmbeddingResponseSchema, OpenAIEmbeddingResponseSchema } from "./schemas.ts"
import type { ParsedVectors } from "./types.ts"

export function parseOpenAIEmbeddings(text: string, count: number): ParsedVectors {
  try {
    const response = JSON.parse(text)
    if (!Value.Check(OpenAIEmbeddingResponseSchema, response) || response.data.length !== count) {
      return { succeeded: false, status: "invalid-response" }
    }
    const vectors = new Map<number, number[]>()
    for (const item of response.data) {
      const vector = normalizeVector(item.embedding, 1536)
      if (item.index >= count || vectors.has(item.index) || !vector) {
        return { succeeded: false, status: "invalid-response" }
      }
      vectors.set(item.index, vector)
    }
    return { succeeded: true, output: [...vectors.entries()].sort(([a], [b]) => a - b).map(([, vector]) => vector) }
  } catch {
    return { succeeded: false, status: "invalid-response" }
  }
}

export function parseGoogleEmbedding(text: string): ParsedVectors {
  try {
    const response = JSON.parse(text)
    if (!Value.Check(GoogleEmbeddingResponseSchema, response)) {
      return { succeeded: false, status: "invalid-response" }
    }
    const vector = normalizeVector(response.embedding.values, 768)
    if (!vector) {
      return { succeeded: false, status: "invalid-response" }
    }
    return { succeeded: true, output: [vector] }
  } catch {
    return { succeeded: false, status: "invalid-response" }
  }
}

import { describe, expect, it } from "vitest"

import { localEmbeddingConfiguration } from "#/domain"
import { finishEmbeddingBatch } from "#/services"
import { embeddingVector } from "#test-helpers"

describe("finishEmbeddingBatch", () => {
  it("averages all chunks of each input independently and rejects missing chunks", () => {
    const request = {
      purpose: "document",
      inputs: [
        { key: "a", text: "one" },
        { key: "b", text: "two" },
      ],
    } as const
    const chunks = [
      { inputIndex: 0, text: "one" },
      { inputIndex: 0, text: "tail" },
      { inputIndex: 1, text: "two" },
    ]
    const vectors = [embeddingVector(384, 0), embeddingVector(384, 1), embeddingVector(384, 2)]
    const result = finishEmbeddingBatch(localEmbeddingConfiguration, request, chunks, vectors)
    expect(result.succeeded).toBe(true)
    if (result.succeeded) {
      expect(result.output.items[0]?.vector[0]).toBeCloseTo(Math.SQRT1_2)
      expect(result.output.items[0]?.vector[1]).toBeCloseTo(Math.SQRT1_2)
      expect(result.output.items[1]?.vector[2]).toBe(1)
    }
    expect(finishEmbeddingBatch(localEmbeddingConfiguration, request, chunks, vectors.slice(1))).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    const missingInput = finishEmbeddingBatch(
      localEmbeddingConfiguration,
      request,
      chunks.slice(0, 2),
      vectors.slice(0, 2),
    )
    expect(missingInput).toEqual({ succeeded: false, status: "invalid-response" })
  })
})

import { describe, expect, it } from "vitest"

import { embedOpenAI } from "#/services"
import {
  embeddingServer,
  embeddingVector,
  openAIResponse,
  recordedEmbeddingBody,
  remoteEmbeddingContext,
} from "#test-helpers"

describe("embedOpenAI", () => {
  it("sends float input with injected auth and maps reordered response indices", async () => {
    const server = await embeddingServer([openAIResponse([1, 0])])
    try {
      const result = await embedOpenAI(remoteEmbeddingContext(server.endpoint), {
        purpose: "document",
        inputs: [
          { key: "a", text: "first" },
          { key: "b", text: "second" },
        ],
      })
      expect(result.succeeded).toBe(true)
      if (result.succeeded) {
        expect(result.output.dimensions).toBe(1536)
        expect(result.output.items.map((item) => [item.key, item.vector[0], item.vector[1]])).toEqual([
          ["a", 1, 0],
          ["b", 0, 1],
        ])
      }
      expect(server.requests[0]?.headers.authorization).toBe("Bearer synthetic-test-key")
      expect(JSON.parse(recordedEmbeddingBody(server.requests[0]))).toEqual({
        model: "text-embedding-3-small",
        input: ["first", "second"],
        encoding_format: "float",
        dimensions: 1536,
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    openAIResponse([0, 0]),
    openAIResponse([0]),
    "not json",
    JSON.stringify({ data: [{ index: 0, embedding: [0] }] }),
  ])("refuses malformed or incomplete responses", async (body) => {
    const server = await embeddingServer([body])
    try {
      expect(
        await embedOpenAI(remoteEmbeddingContext(server.endpoint), {
          purpose: "query",
          inputs: [
            { key: "a", text: "one" },
            { key: "b", text: "two" },
          ],
        }),
      ).toEqual({ succeeded: false, status: "invalid-response" })
    } finally {
      await server.close()
    }
  })

  it("embeds the tail of long documents and refuses long queries without sending", async () => {
    const response = JSON.stringify({
      object: "list",
      model: "text-embedding-3-small",
      data: [0, 1].map((index) => ({ object: "embedding", index, embedding: embeddingVector(1536) })),
      usage: { prompt_tokens: 1, total_tokens: 1 },
    })
    const server = await embeddingServer([response])
    try {
      const text = `${"x".repeat(4200)}TAIL`
      const context = remoteEmbeddingContext(server.endpoint)
      expect((await embedOpenAI(context, { purpose: "document", inputs: [{ key: "a", text }] })).succeeded).toBe(true)
      expect(server.requests[0]?.body).toContain("TAIL")
      expect(await embedOpenAI(context, { purpose: "query", inputs: [{ key: "a", text }] })).toEqual({
        succeeded: false,
        status: "input-too-long",
      })
      expect(server.requests).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it.each([401, 429, 503])("reports HTTP %s without leaking provider bodies", async (status) => {
    const server = await embeddingServer(["synthetic-secret-body"], status)
    try {
      expect(
        await embedOpenAI(remoteEmbeddingContext(server.endpoint), {
          purpose: "query",
          inputs: [{ key: "a", text: "test" }],
        }),
      ).toEqual({ succeeded: false, status: "unavailable" })
    } finally {
      await server.close()
    }
  })
})

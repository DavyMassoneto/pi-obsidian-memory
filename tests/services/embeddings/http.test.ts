import { describe, expect, it } from "vitest"

import { embedOpenAI } from "#src/services"
import { embeddingServer, openAIResponse, remoteEmbeddingContext } from "#test-helpers"

describe("embedding HTTP boundary", () => {
  it("refuses empty credentials and non-provider endpoints without sending", async () => {
    const server = await embeddingServer([openAIResponse([0])])
    const request = { purpose: "query", inputs: [{ key: "a", text: "one" }] } as const
    try {
      expect(await embedOpenAI({ ...remoteEmbeddingContext(server.endpoint), apiKey: "" }, request)).toEqual({
        succeeded: false,
        status: "unavailable",
      })
      expect(await embedOpenAI(remoteEmbeddingContext("https://example.invalid/embeddings"), request)).toEqual({
        succeeded: false,
        status: "unavailable",
      })
      expect(server.requests).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  it("refuses oversized provider responses", async () => {
    const server = await embeddingServer([" ".repeat(4_000_001)])
    try {
      expect(
        await embedOpenAI(remoteEmbeddingContext(server.endpoint), {
          purpose: "query",
          inputs: [{ key: "a", text: "one" }],
        }),
      ).toEqual({ succeeded: false, status: "invalid-response" })
    } finally {
      await server.close()
    }
  })
})

import { describe, expect, it } from "vitest"

import { embedGoogle } from "#/services"
import { embeddingServer, googleResponse, recordedEmbeddingBody, remoteEmbeddingContext } from "#test-helpers"

describe("embedGoogle", () => {
  it.each(["query", "document"] as const)(
    "embeds each %s independently with the retrieval task and normalizes",
    async (purpose) => {
      const server = await embeddingServer([googleResponse()])
      try {
        const result = await embedGoogle(remoteEmbeddingContext(server.endpoint), {
          purpose,
          inputs: [
            { key: "a", text: "one" },
            { key: "b", text: "two" },
          ],
        })
        expect(result.succeeded).toBe(true)
        if (result.succeeded) {
          expect(result.output.dimensions).toBe(768)
          expect(result.output.items.map((item) => [item.key, item.vector[0]])).toEqual([
            ["a", 1],
            ["b", 1],
          ])
        }
        expect(server.requests).toHaveLength(2)
        expect(server.requests[0]?.headers["x-goog-api-key"]).toBe("synthetic-test-key")
        expect(JSON.parse(recordedEmbeddingBody(server.requests[0]))).toEqual({
          content: { parts: [{ text: "one" }] },
          taskType: `RETRIEVAL_${purpose.toUpperCase()}`,
          outputDimensionality: 768,
          embedContentConfig: { autoTruncate: false },
        })
      } finally {
        await server.close()
      }
    },
  )

  it.each(["{}", "broken", '{"embedding":{"values":[]}}', '{"embedding":{"values":[1e999]}}'])(
    "refuses invalid vector response",
    async (body) => {
      const server = await embeddingServer([body])
      try {
        expect(
          await embedGoogle(remoteEmbeddingContext(server.endpoint), {
            purpose: "query",
            inputs: [{ key: "a", text: "one" }],
          }),
        ).toEqual({ succeeded: false, status: "invalid-response" })
      } finally {
        await server.close()
      }
    },
  )

  it("includes the tail of long documents and refuses long queries before HTTP", async () => {
    const server = await embeddingServer([googleResponse()])
    const text = `${"🌎".repeat(300)}TAIL`
    const context = remoteEmbeddingContext(server.endpoint)
    try {
      expect((await embedGoogle(context, { purpose: "document", inputs: [{ key: "a", text }] })).succeeded).toBe(true)
      expect(server.requests).toHaveLength(2)
      expect(server.requests[1]?.body).toContain("TAIL")
      expect(await embedGoogle(context, { purpose: "query", inputs: [{ key: "a", text }] })).toEqual({
        succeeded: false,
        status: "input-too-long",
      })
      expect(server.requests).toHaveLength(2)
    } finally {
      await server.close()
    }
  })

  it("returns a typed deadline and abort; cancellation sends no request", async () => {
    const server = await embeddingServer([googleResponse()], 200, 100)
    try {
      const request = { purpose: "query", inputs: [{ key: "a", text: "one" }] } as const
      expect(await embedGoogle({ ...remoteEmbeddingContext(server.endpoint), timeoutMs: 10 }, request)).toEqual({
        succeeded: false,
        status: "deadline",
      })
      const controller = new AbortController()
      controller.abort()
      expect(
        await embedGoogle({ ...remoteEmbeddingContext(server.endpoint), signal: controller.signal }, request),
      ).toEqual({ succeeded: false, status: "aborted" })
    } finally {
      await server.close()
    }
  })
})

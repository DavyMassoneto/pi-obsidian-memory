import { describe, expect, it } from "vitest"

import { decideMemory } from "#/services"
import { decisionServer, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Laya response validation", () => {
  it("accepts a native passed abstention gate without treating confidence as probability", async () => {
    const body = layaReply(0.9).replace(
      '"noul":0.9',
      '"noul":0.9,"abstention":"passed","abstention_threshold":0.7,"low_confidence":false',
    )
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
        succeeded: true,
        output: { probability: 0.9 },
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    ["missing", '{"model":"laya","answers":{}}', "invalid-response"],
    ["wrong type", layaReply(0.5).replace('"noul"', '"score"'), "invalid-response"],
    ["negative", layaReply(-0.1), "invalid-response"],
    ["too large", layaReply(1.1), "invalid-response"],
    ["nonfinite", layaReply(0.5).replace('"noul":0.5', '"noul":1e999'), "invalid-response"],
    ["string", layaReply(0.5).replace('"noul":0.5', '"noul":"0.5"'), "invalid-response"],
    ["invalid JSON", "sample-token-not-json", "invalid-response"],
    ["unknown field", layaReply(0.5).replace('"answers":', '"error":"sample-token","answers":'), "invalid-response"],
    ["truncation", layaReply(0.5).replace('"truncated":false', '"truncated":true'), "truncated"],
    ["dropped", layaReply(0.5).replace('"state_tokens_dropped":0', '"state_tokens_dropped":1'), "truncated"],
    [
      "question cut",
      layaReply(0.5).replace('"truncated_questions":[]', '"truncated_questions":["needed"]'),
      "truncated",
    ],
    [
      "collapsed",
      layaReply(0.5).replace(
        '"truncated":false',
        '"options":{"needed":{"total":2,"distinct":1,"tokens_per_option":0}},"truncated":false',
      ),
      "collapsed-options",
    ],
    ["oversized response", " ".repeat(65_536) + layaReply(0.5), "invalid-response"],
    ["missing truncation evidence", layaReply(0.5).replace('"truncated":false,', ""), "invalid-response"],
    ["abstention", layaReply(0.5).replace('"noul":0.5', '"noul":0.5,"abstention":"abstained"'), "invalid-response"],
    ["unevaluated", layaReply(0.5).replace('"noul":0.5', '"noul":0.5,"abstention":"unevaluated"'), "invalid-response"],
    ["low confidence", layaReply(0.5).replace('"noul":0.5', '"noul":0.5,"low_confidence":true'), "invalid-response"],
  ])("refuses %s without leaking response text", async (_name, body, code) => {
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const result = await decideMemory({ context: server.context, request: memoryDecisionRequest })
      expect(result).toMatchObject({ succeeded: false, code })
      expect(JSON.stringify(result)).not.toContain("sample-token")
    } finally {
      await server.close()
    }
  })
})

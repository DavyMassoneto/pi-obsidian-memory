import { describe, expect, it } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, layaReply, memoryDecisionRequest } from "#test-helpers"

describe("Laya response validation", () => {
  it.each([
    ["custom-multilingual", "multilingual"],
    ["multilingual", "english"],
    ["en", "multilingual"],
    ["convaiinnovations/laya", "english"],
    ["auto", "multilingual"],
    ["auto", "auto"],
    ["ml", "ml"],
    ["laya_multilingual", "multilingual"],
    ["convaiinnovations/laya/multilingual", "multilingual"],
  ])("refuses requested %s routed to %s and retains the selected checkpoint", async (model, checkpoint) => {
    const server = await decisionServer({ body: layaReply(0.9, checkpoint), status: 200, delayMs: 0 })
    try {
      const result = await decideMemory({
        context: { ...server.context, model },
        request: memoryDecisionRequest,
      })
      expect(result).toMatchObject({
        succeeded: false,
        code: "invalid-response",
        diagnostics: { requestedModel: model, reportedModel: checkpoint },
      })
      expect(result).not.toHaveProperty("output")
      expect(server.requests).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  it.each(["custom-multilingual", "multilingual", "auto", "jev-1", "convaiinnovations/laya"])(
    "refuses automatic language-hint routing for %s even without detection or workflow",
    async (model) => {
      const body = layaReply(0.9).replace(
        "explicit model='multilingual'",
        "Router(lang_guess=...): the caller identified this as non-English text",
      )
      const server = await decisionServer({ body, status: 200, delayMs: 0 })
      try {
        expect(
          await decideMemory({ context: { ...server.context, model }, request: memoryDecisionRequest }),
        ).toMatchObject({
          succeeded: false,
          code: "invalid-response",
          diagnostics: { requestedModel: model, reportedModel: "multilingual" },
        })
      } finally {
        await server.close()
      }
    },
  )

  it("reports missing routing (LAYA_JEV_STRICT) as routing-missing even when the engine claims the requested model", async () => {
    const body = layaReply(0.9)
      .replace(/,"routing":\{[^}]*\}/, "")
      .replace("laya-rl-agent", "multilingual")
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
        succeeded: false,
        code: "routing-missing",
        diagnostics: { reportedModel: null },
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    ["en", "english"],
    ["laya", "english"],
    ["default", "english"],
    ["multi", "multilingual"],
    ["ml", "multilingual"],
    ["laya-multilingual", "multilingual"],
    ["typed", "typed-decisions"],
    ["typed_decisions", "typed-decisions"],
    ["laya-typed-decisions", "typed-decisions"],
    ["decisions", "typed-decisions"],
    ["convaiinnovations/laya-multilingual", "multilingual"],
    ["convaiinnovations/laya-typed-decisions", "typed-decisions"],
    ["ML", "multilingual"],
    ["Custom-Multilingual", "custom-multilingual"],
  ])("accepts pinned-source spelling %s explicitly routed to %s", async (model, checkpoint) => {
    const server = await decisionServer({ body: layaReply(0.9, checkpoint), status: 200, delayMs: 0 })
    try {
      expect(
        await decideMemory({ context: { ...server.context, model }, request: memoryDecisionRequest }),
      ).toMatchObject({
        succeeded: true,
        output: { probability: 0.9, diagnostics: { requestedModel: model, reportedModel: checkpoint } },
      })
      expect(server.requests[0]).toContain(`"model":"${model}"`)
    } finally {
      await server.close()
    }
  })

  it.each([
    ["truncated flag", layaReply(0.5).replace('"truncated":false', '"truncated":true')],
    ["dropped state tokens", layaReply(0.5).replace('"state_tokens_dropped":0', '"state_tokens_dropped":1')],
    ["cut question", layaReply(0.5).replace('"truncated_questions":[]', '"truncated_questions":["needed"]')],
    ["a missing truncation report", layaReply(0.5).replace('"truncated":false,', "")],
    [
      "abstention fields we never request",
      layaReply(0.5).replace('"noul":0.5', '"noul":0.5,"abstention":"abstained","low_confidence":true'),
    ],
  ])("scores a response with %s, because the score covers the start of the state", async (_name, body) => {
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
        succeeded: true,
        output: { probability: 0.5 },
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    ["missing", '{"model":"laya","answers":{}}', "invalid-response"],
    ["wrong type", layaReply(0.5).replace('"noul"', '"score"'), "invalid-response"],
    ["unverifiable routing", layaReply(0.5).replace("explicit model='multilingual'", ""), "invalid-response"],
    [
      "wrong explicit route",
      layaReply(0.5).replace("explicit model='multilingual'", "explicit model='ml'"),
      "invalid-response",
    ],
    ["negative", layaReply(-0.1), "invalid-response"],
    ["too large", layaReply(1.1), "invalid-response"],
    ["nonfinite", layaReply(0.5).replace('"noul":0.5', '"noul":1e999'), "invalid-response"],
    ["string", layaReply(0.5).replace('"noul":0.5', '"noul":"0.5"'), "invalid-response"],
    ["invalid JSON", "sample-token-not-json", "invalid-response"],
    [
      "collapsed",
      layaReply(0.5).replace(
        '"truncated":false',
        '"options":{"needed":{"total":2,"distinct":1,"tokens_per_option":0}},"truncated":false',
      ),
      "collapsed-options",
    ],
    ["oversized response", " ".repeat(65_536) + layaReply(0.5), "invalid-response"],
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

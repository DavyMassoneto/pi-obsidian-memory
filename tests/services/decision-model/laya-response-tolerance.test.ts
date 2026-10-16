import { describe, expect, it } from "vitest"

import { decideMemory } from "#src/services"
import { decisionServer, layaReply, memoryDecisionRequest } from "#test-helpers"

const extended = layaReply(0.9)
  .replace('"answers":', '"x_trace":{"id":"t-1"},"answers":')
  .replace('"noul":0.9', '"noul":0.9,"x_jev_confidence":0.4,"x_tournament":{"rounds":2}')
  .replace('"act_probability":0.01', '"act_probability":0.01,"extra":true')
  .replace('"state_tokens":5', '"state_tokens":5,"x_latency_ms":12')
  .replace('"detection":null', '"detection":null,"x_route":"fast"')

describe("Laya response tolerance", () => {
  it.each([
    ["fields a newer server adds at every level", extended],
    ["a response without the root model", layaReply(0.9).replace('"model":"laya-rl-agent",', "")],
    ["usage without state_tokens", layaReply(0.9).replace('"state_tokens":5,', "")],
    ["routing without repo", layaReply(0.9).replace('"repo":null,', "")],
    ["routing without detection and workflow", layaReply(0.9).replace(',"detection":null,"workflow":null', "")],
  ])("accepts %s", async (_name, body) => {
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
        succeeded: true,
        output: { probability: 0.9, diagnostics: { reportedModel: "multilingual" } },
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    ["an answer without noul", layaReply(0.9).replace('"noul":0.9,', "")],
    ["usage without input tokens", layaReply(0.9).replace('"input_tokens":14,', "")],
    ["usage without truncated", layaReply(0.9).replace('"truncated":false,', "")],
    ["routing without model", layaReply(0.9).replace('"model":"multilingual",', "")],
    ["routing without reason", layaReply(0.9).replace(`"reason":"explicit model='multilingual'",`, "")],
    ["routing reason of the wrong type", layaReply(0.9).replace(`"explicit model='multilingual'"`, "7")],
    [
      "an answer for a question we did not ask",
      layaReply(0.9).replace('"answers":{', '"answers":{"other":{"type":"noul","noul":0.5},'),
    ],
  ])("still refuses %s", async (_name, body) => {
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(await decideMemory({ context: server.context, request: memoryDecisionRequest })).toMatchObject({
        succeeded: false,
        code: "invalid-response",
      })
    } finally {
      await server.close()
    }
  })
})

describe("Laya alias routing", () => {
  it.each([
    ["laya", "english"],
    ["en", "english"],
    ["ML", "multilingual"],
    ["laya-multilingual", "multilingual"],
    ["convaiinnovations/laya-typed-decisions", "typed-decisions"],
  ])("accepts alias %s whose reason carries the raw requested name", async (model, checkpoint) => {
    const body = layaReply(0.9, checkpoint).replace(`explicit model='${checkpoint}'`, `explicit model='${model}'`)
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(
        await decideMemory({ context: { ...server.context, model }, request: memoryDecisionRequest }),
      ).toMatchObject({
        succeeded: true,
        output: { probability: 0.9, diagnostics: { requestedModel: model, reportedModel: checkpoint } },
      })
    } finally {
      await server.close()
    }
  })

  it.each([
    ["laya", "english", "explicit model='multilingual'"],
    ["laya", "english", "explicit model='ml'"],
    ["laya", "english", "explicit model='laya' "],
    ["laya", "multilingual", "explicit model='laya'"],
    ["laya", "english", "Router(lang_guess=...): the caller identified this as non-English text"],
  ])("refuses requested %s routed to %s with reason %j", async (model, checkpoint, reason) => {
    const body = layaReply(0.9, checkpoint).replace(`explicit model='${checkpoint}'`, reason)
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      expect(
        await decideMemory({ context: { ...server.context, model }, request: memoryDecisionRequest }),
      ).toMatchObject({ succeeded: false, code: "invalid-response" })
    } finally {
      await server.close()
    }
  })
})

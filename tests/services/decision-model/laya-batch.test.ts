import { describe, expect, it } from "vitest"

import { classifyLayaBatch } from "#src/services"
import { candidateBatchItems, decisionServer, layaBatchReply, layaCandidateReply } from "#test-helpers"

describe("classifyLayaBatch", () => {
  it("posts the states and one shared question to the batch endpoint and keeps the order", async () => {
    const body = layaBatchReply([layaCandidateReply(0.8), layaCandidateReply(0.2)])
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const items = candidateBatchItems(2)
      const results = await classifyLayaBatch(server.context, { items, signal: new AbortController().signal })
      expect(results).toMatchObject([
        { succeeded: true, output: { probability: 0.8, diagnostics: { reportedModel: "multilingual" } } },
        { succeeded: true, output: { probability: 0.2 } },
      ])
      expect(server.urls).toEqual(["/v1/systemone/batch"])
      const [raw] = server.requests
      if (!raw) throw new Error("No request")
      const sent = JSON.parse(raw)
      expect(Object.keys(sent)).toEqual(["model", "states", "questions", "max_len", "head_max_len"])
      expect(sent.states).toEqual(items.map((item) => item.prompt.state))
      expect(Object.keys(sent.questions.relevant)).toEqual(["type", "instructions", "criteria"])
      expect(sent.questions.relevant.type).toBe("noul")
    } finally {
      await server.close()
    }
  })

  it.each([
    [64, [64]],
    [65, [64, 1]],
    [130, [64, 64, 2]],
  ])("splits %i items into chunks of at most 64 and keeps every result in place", async (count, sizes) => {
    const bodyFor = (request: string) => {
      const states = JSON.parse(request).states.length
      return layaBatchReply(Array.from({ length: states }, (_, index) => layaCandidateReply(index / 100)))
    }
    const server = await decisionServer({ body: "", bodyFor, status: 200, delayMs: 0 })
    try {
      const results = await classifyLayaBatch(server.context, {
        items: candidateBatchItems(count),
        signal: new AbortController().signal,
      })
      expect(server.requests.map((request) => JSON.parse(request).states.length)).toEqual(sizes)
      expect(results).toHaveLength(count)
      expect(results.every((result) => result.succeeded)).toBe(true)
      expect(results[63]).toMatchObject({ output: { probability: 0.63 } })
    } finally {
      await server.close()
    }
  })

  it("sends nothing for an empty list", async () => {
    const server = await decisionServer({ body: "", status: 200, delayMs: 0 })
    try {
      expect(await classifyLayaBatch(server.context, { items: [], signal: new AbortController().signal })).toEqual([])
      expect(server.requests).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  it.each([
    ["too few results", layaBatchReply([layaCandidateReply(0.5)])],
    ["too many results", layaBatchReply([layaCandidateReply(0.5), layaCandidateReply(0.5), layaCandidateReply(0.5)])],
    ["no results field", JSON.stringify({ total_usage: { input_tokens: 0, output_tokens: 0 } })],
    ["results that is not a list", JSON.stringify({ results: "sample-token" })],
    ["a result that is not an object", JSON.stringify({ results: [1, 2] })],
    ["invalid JSON", "sample-token-not-json"],
    [
      "an oversized body",
      " ".repeat(64 * 65_536 + 1) + layaBatchReply([layaCandidateReply(0.5), layaCandidateReply(0.5)]),
    ],
  ])("fails every item as invalid-response for %s", async (_name, body) => {
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const results = await classifyLayaBatch(server.context, {
        items: candidateBatchItems(2),
        signal: new AbortController().signal,
      })
      expect(results).toMatchObject([
        { succeeded: false, code: "invalid-response" },
        { succeeded: false, code: "invalid-response" },
      ])
      expect(JSON.stringify(results)).not.toContain("sample-token")
    } finally {
      await server.close()
    }
  })

  it("fails only the item whose result is invalid or has no routing", async () => {
    const withoutRouting = layaCandidateReply(0.4).replace(/,"routing":\{[^}]*\}/, "")
    const body = layaBatchReply([layaCandidateReply(0.5), layaCandidateReply(2), withoutRouting])
    const server = await decisionServer({ body, status: 200, delayMs: 0 })
    try {
      const results = await classifyLayaBatch(server.context, {
        items: candidateBatchItems(3),
        signal: new AbortController().signal,
      })
      expect(results).toMatchObject([
        { succeeded: true, output: { probability: 0.5 } },
        { succeeded: false, code: "invalid-response" },
        { succeeded: false, code: "routing-missing" },
      ])
    } finally {
      await server.close()
    }
  })

  it.each([
    [500, '{"detail":"boom"}', undefined],
    [422, '{"detail":"model not served"}', "model not served"],
  ])("fails every item on HTTP %i without leaking other text", async (status, body, detail) => {
    const server = await decisionServer({ body, status, delayMs: 0 })
    try {
      const results = await classifyLayaBatch(server.context, {
        items: candidateBatchItems(2),
        signal: new AbortController().signal,
      })
      for (const result of results) {
        expect(result).toMatchObject({ succeeded: false, code: "http-error", httpStatus: status })
        if (detail) expect(result).toMatchObject({ detail })
        else expect(result).not.toHaveProperty("detail")
      }
    } finally {
      await server.close()
    }
  })

  it("rejects when the server is unreachable or the signal is already aborted", async () => {
    const server = await decisionServer({ body: "", status: 200, delayMs: 0 })
    const aborted = new AbortController()
    aborted.abort()
    await expect(
      classifyLayaBatch(server.context, { items: candidateBatchItems(1), signal: aborted.signal }),
    ).rejects.toThrow()
    await server.close()
    await expect(
      classifyLayaBatch(server.context, { items: candidateBatchItems(1), signal: new AbortController().signal }),
    ).rejects.toThrow()
  })
})

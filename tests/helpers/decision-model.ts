import { createServer } from "node:http"

import { vi } from "vitest"

import type { DecisionBatchItem, JevClassifierResult, JevContext, LayaContext } from "#src/services"

export type SyntheticBodyFor = (request: string) => string

export interface SyntheticDecisionResponse {
  body: string
  status: number
  delayMs: number
  location?: string
  bodyFor?: SyntheticBodyFor
}

export async function decisionServer(reply: SyntheticDecisionResponse) {
  const requests: string[] = []
  const urls: string[] = []
  const server = createServer((request, response) => {
    let body = ""
    request.setEncoding("utf8")
    request.on("data", (chunk: string) => {
      body += chunk
    })
    request.on("end", () => {
      requests.push(body)
      if (request.url) urls.push(request.url)
      const timer = setTimeout(() => {
        response.statusCode = reply.status
        if (reply.location) response.setHeader("location", reply.location)
        if (reply.bodyFor) response.end(reply.bodyFor(body))
        else response.end(reply.body)
      }, reply.delayMs)
      response.on("close", () => clearTimeout(timer))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No synthetic server address")
  const endpoint = `http://127.0.0.1:${address.port}/v1/systemone`
  return {
    requests,
    urls,
    context: layaContext(endpoint),
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        }),
      )
    },
  }
}

export function layaContext(endpoint: string): LayaContext {
  return {
    provider: "laya",
    endpoint,
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
    deadlineMs: Date.now() + 5000,
    signal: new AbortController().signal,
  }
}

export function layaReply(probability: number, checkpoint?: string): string {
  let selectedCheckpoint = "multilingual"
  if (typeof checkpoint === "string") selectedCheckpoint = checkpoint

  return JSON.stringify({
    model: "laya-rl-agent",
    answers: { needed: { type: "noul", noul: probability, action: { act_probability: 0.01 } } },
    usage: {
      input_tokens: 14,
      output_tokens: 0,
      state_tokens: 5,
      state_tokens_dropped: 0,
      truncated: false,
      truncated_questions: [],
    },
    routing: {
      model: selectedCheckpoint,
      repo: null,
      reason: `explicit model='${selectedCheckpoint}'`,
      detection: null,
      workflow: null,
    },
  })
}

export function layaBatchReply(replies: string[]): string {
  return JSON.stringify({
    results: replies.map((reply) => JSON.parse(reply)),
    total_usage: { input_tokens: 0, output_tokens: 0 },
  })
}

export function layaCandidateReply(probability: number): string {
  return layaReply(probability).replaceAll("needed", "relevant")
}

export function candidateBatchItems(count: number): DecisionBatchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    prompt: {
      state: {
        candidate: { statement: `Note ${index}`, body: "Body" },
        message: candidateDecisionRequest.message,
      },
      questions: {
        relevant: {
          type: "bool",
          instructions: "Would this candidate memory materially help answer the message?",
          criteria: { true: "Candidate would help", false: "Candidate would not help" },
        },
      },
    },
    diagnostics: { provider: "laya", requestedModel: "multilingual", reportedModel: null, usage: null },
  }))
}

export function jevContext(result: JevClassifierResult): JevContext {
  return {
    provider: "typesafe",
    model: "jev-latest",
    deadlineMs: Date.now() + 5000,
    signal: new AbortController().signal,
    classifier: { classify: vi.fn().mockResolvedValue(result) },
  }
}

export function jevReply(probability: number): JevClassifierResult {
  return jevAnswerReply({ needed: { type: "bool", probability } })
}

export function jevRelevantReply(probability: number): JevClassifierResult {
  return jevAnswerReply({ relevant: { type: "bool", probability } })
}

function jevAnswerReply(answers: JevClassifierResult["answers"]): JevClassifierResult {
  return {
    api: "typesafe-classifier",
    provider: "typesafe",
    model: "jev-latest",
    answers,
    usage: {
      input: 10,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 10,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 1_700_000_000_000,
  }
}

export const memoryDecisionRequest = { message: "Qual gerenciador uso?", project: "shop", folder: "src" }
export const candidateDecisionRequest = {
  message: "Qual gerenciador uso?",
  identity: { vault: "global" as const, id: "stable-note", revision: "hash" },
  candidate: { statement: "Use pnpm", body: "Secret sample-token stays literal." },
}

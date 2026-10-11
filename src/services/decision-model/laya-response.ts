import { Value } from "typebox/value"

import type { DecisionResult } from "#/domain"
import { maxDecisionResponseBytes } from "./constants.ts"
import { LayaResponseSchema } from "./schemas.ts"
import type { LayaReadRequest, LayaResponse } from "./types.ts"

async function readBoundedText(response: Response): Promise<string | null> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return Buffer.concat(chunks).toString("utf8")
      size += chunk.value.byteLength
      if (size > maxDecisionResponseBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
}

function interpretResponse(parsed: LayaResponse, request: LayaReadRequest): DecisionResult {
  const { diagnostics, question } = request
  const usage = parsed.usage
  if (usage.truncated || usage.state_tokens_dropped > 0 || usage.truncated_questions.length > 0) {
    return { succeeded: false, code: "truncated", diagnostics }
  }
  if (usage.options && Object.keys(usage.options).length > 0) {
    return { succeeded: false, code: "collapsed-options", diagnostics }
  }
  const answer = parsed.answers[question]
  if (!answer || Object.keys(parsed.answers).length !== 1) {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  if (answer.low_confidence || answer.abstention === "abstained" || answer.abstention === "unevaluated") {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  return {
    succeeded: true,
    output: {
      probability: answer.noul,
      diagnostics: {
        ...diagnostics,
        reportedModel: parsed.model,
        usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
      },
    },
  }
}

export async function readLayaResponse(request: LayaReadRequest): Promise<DecisionResult> {
  const text = await readBoundedText(request.response)
  const diagnostics = request.diagnostics
  if (typeof text !== "string") return { succeeded: false, code: "invalid-response", diagnostics }
  try {
    const parsed = JSON.parse(text)
    if (!Value.Check(LayaResponseSchema, parsed)) return { succeeded: false, code: "invalid-response", diagnostics }
    return interpretResponse(parsed, request)
  } catch {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
}

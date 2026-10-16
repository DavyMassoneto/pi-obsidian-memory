import { Value } from "typebox/value"

import type { DecisionDiagnostics, DecisionResult } from "#src/domain"
import { maxDecisionResponseBytes } from "./constants.ts"
import { LayaResponseSchema } from "./schemas.ts"
import type { LayaReadRequest, LayaResponse, LayaResultCandidate, LayaValueRequest } from "./types.ts"

export async function readBoundedText(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return Buffer.concat(chunks).toString("utf8")
      size += chunk.value.byteLength
      if (size > limit) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
}

function requestedCheckpoint(model: string): string | null {
  const name = model.toLowerCase()
  if (["en", "laya", "default"].includes(name)) return "english"
  if (["multi", "ml", "laya-multilingual", "convaiinnovations/laya-multilingual"].includes(name)) {
    return "multilingual"
  }
  if (
    [
      "typed",
      "typed_decisions",
      "laya-typed-decisions",
      "decisions",
      "convaiinnovations/laya-typed-decisions",
    ].includes(name)
  ) {
    return "typed-decisions"
  }
  if (name === "auto" || !/^[a-z0-9][a-z0-9._-]*$/.test(name)) return null
  return name
}

function explicitlyRouted(reason: string, requested: string, checkpoint: string): boolean {
  return reason === `explicit model='${requested}'` || reason === `explicit model='${checkpoint}'`
}

function interpretResponse(parsed: LayaResponse, request: LayaValueRequest): DecisionResult {
  const { question } = request
  const usage = parsed.usage
  const routing = parsed.routing
  const diagnostics: DecisionDiagnostics = {
    ...request.diagnostics,
    reportedModel: null,
    usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
  }
  if (!routing) return { succeeded: false, code: "routing-missing", diagnostics }
  diagnostics.reportedModel = routing.model

  const checkpoint = requestedCheckpoint(diagnostics.requestedModel)
  if (routing.model !== checkpoint || !explicitlyRouted(routing.reason, diagnostics.requestedModel, checkpoint)) {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  if (usage.options && Object.keys(usage.options).length > 0) {
    return { succeeded: false, code: "collapsed-options", diagnostics }
  }
  const answer = parsed.answers[question]
  if (!answer || Object.keys(parsed.answers).length !== 1) {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  return { succeeded: true, output: { probability: answer.noul, diagnostics } }
}

export function interpretLayaValue(value: LayaResultCandidate, request: LayaValueRequest): DecisionResult {
  if (!Value.Check(LayaResponseSchema, value)) {
    return { succeeded: false, code: "invalid-response", diagnostics: request.diagnostics }
  }
  return interpretResponse(value, request)
}

export async function readLayaResponse(request: LayaReadRequest): Promise<DecisionResult> {
  const text = await readBoundedText(request.response, maxDecisionResponseBytes)
  if (typeof text !== "string") return { succeeded: false, code: "invalid-response", diagnostics: request.diagnostics }
  try {
    return interpretLayaValue(JSON.parse(text), request)
  } catch {
    return { succeeded: false, code: "invalid-response", diagnostics: request.diagnostics }
  }
}

import { Value } from "typebox/value"

import type { DecisionResult, DecisionUsage } from "#src/domain"
import { modelVersionPattern } from "./constants.ts"
import { JevResultSchema } from "./schemas.ts"
import type { JevContext, ProviderCall } from "./types.ts"

function modelFamily(id: string): string {
  return id.slice(0, id.lastIndexOf("-"))
}

function modelTail(id: string): string {
  return id.slice(id.lastIndexOf("-") + 1)
}

export function answeredByRequestedModel(requested: string, reported: string): boolean {
  if (reported === requested) return true
  if (!requested.includes("-") || !reported.includes("-")) return false
  return (
    modelFamily(requested) === modelFamily(reported) &&
    !modelVersionPattern.test(modelTail(requested)) &&
    modelVersionPattern.test(modelTail(reported))
  )
}

export async function classifyJev(context: JevContext, call: ProviderCall): Promise<DecisionResult> {
  const diagnostics = call.diagnostics
  const result = await context.classifier.classify({
    model: { provider: "typesafe", id: context.model },
    context: call.prompt,
    options: { signal: call.signal, maxRetries: 0 },
  })
  if (!Value.Check(JevResultSchema, result)) return { succeeded: false, code: "invalid-response", diagnostics }
  if (result.stopReason === "aborted") return { succeeded: false, code: "aborted", diagnostics }
  if (result.stopReason === "error") return { succeeded: false, code: "unavailable", diagnostics }
  const answer = result.answers[call.question]
  if (
    !answeredByRequestedModel(context.model, result.model) ||
    answer?.type !== "bool" ||
    typeof answer.probability !== "number"
  ) {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  let usage: DecisionUsage | null = null
  if (result.usage) usage = { inputTokens: result.usage.input, outputTokens: result.usage.output }
  return {
    succeeded: true,
    output: {
      probability: answer.probability,
      diagnostics: { ...diagnostics, reportedModel: result.model, usage },
    },
  }
}

export async function classifyJevSettled(context: JevContext, call: ProviderCall): Promise<DecisionResult> {
  try {
    return await classifyJev(context, call)
  } catch {
    return { succeeded: false, code: "unavailable", diagnostics: call.diagnostics }
  }
}

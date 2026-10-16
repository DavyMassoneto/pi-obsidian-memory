import { Value } from "typebox/value"

import type { DecisionResult, DecisionUsage } from "#src/domain"
import { JevResultSchema } from "./schemas.ts"
import type { JevContext, ProviderCall } from "./types.ts"

export async function classifyJev(context: JevContext, call: ProviderCall): Promise<DecisionResult> {
  const diagnostics = call.diagnostics
  const result = await context.classifier.classify({
    model: { provider: "typesafe", id: context.model },
    context: call.prompt,
    options: { signal: call.signal, timeoutMs: call.timeoutMs, maxRetries: 0 },
  })
  if (!Value.Check(JevResultSchema, result)) return { succeeded: false, code: "invalid-response", diagnostics }
  if (result.stopReason === "aborted") return { succeeded: false, code: "aborted", diagnostics }
  if (result.stopReason === "error") return { succeeded: false, code: "unavailable", diagnostics }
  if (
    result.model !== context.model ||
    result.answer?.type !== "bool" ||
    typeof result.answer.probability !== "number"
  ) {
    return { succeeded: false, code: "invalid-response", diagnostics }
  }
  let usage: DecisionUsage | null = null
  if (result.usage) usage = { inputTokens: result.usage.input, outputTokens: result.usage.output }
  return {
    succeeded: true,
    output: {
      probability: result.answer.probability,
      diagnostics: { ...diagnostics, reportedModel: result.model, usage },
    },
  }
}

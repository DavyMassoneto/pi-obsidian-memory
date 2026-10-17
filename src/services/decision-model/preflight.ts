import { Value } from "typebox/value"

import type { DecisionFailureCode } from "#src/domain"
import { isLoopbackEndpoint } from "./endpoint.ts"
import { DecisionModelNameSchema } from "./schemas.ts"
import type { DecisionContext } from "./types.ts"

export function decisionPreflight(context: DecisionContext): DecisionFailureCode | null {
  if (context.signal.aborted) return "aborted"
  if (!Value.Check(DecisionModelNameSchema, context.model)) return "invalid-settings"
  if (context.provider === "typesafe") return null
  if (!isLoopbackEndpoint(context.endpoint)) return "unsafe-endpoint"
  if (!Number.isInteger(context.maxTokens) || context.maxTokens < 1 || context.maxTokens > 8192) {
    return "invalid-settings"
  }
  if (
    !Number.isInteger(context.headMaxTokens) ||
    context.headMaxTokens < 1 ||
    context.headMaxTokens >= context.maxTokens
  ) {
    return "invalid-settings"
  }
  return null
}

import { Value } from "typebox/value"

import type { DecisionFailureCode } from "#src/domain"
import { decisionTimeoutMs } from "./constants.ts"
import { isLoopbackEndpoint } from "./endpoint.ts"
import { DecisionModelNameSchema } from "./schemas.ts"
import type { DecisionContext } from "./types.ts"

export function decisionPreflight(context: DecisionContext): DecisionFailureCode | null {
  if (context.signal.aborted) return "aborted"
  if (!Number.isSafeInteger(context.deadlineMs)) return "invalid-settings"
  if (context.deadlineMs <= Date.now()) return "deadline"
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

export function remainingDecisionMs(context: DecisionContext): number {
  return Math.max(1, Math.min(decisionTimeoutMs, context.deadlineMs - Date.now()))
}

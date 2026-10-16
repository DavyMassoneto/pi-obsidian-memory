import type { DecisionDiagnostics } from "#src/domain"
import type { DecisionContext } from "./types.ts"

export function initialDiagnostics(context: DecisionContext): DecisionDiagnostics {
  return { provider: context.provider, requestedModel: context.model, reportedModel: null, usage: null }
}

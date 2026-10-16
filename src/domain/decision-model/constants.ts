import type { DecisionCutoffs, DecisionProvider } from "./types.ts"

export const DEFAULT_CUTOFFS = new Map<DecisionProvider, Partial<DecisionCutoffs>>([
  ["typesafe", { gate: 0.5, relevance: 0.5 }],
])

export const MAX_FAILURE_DETAIL_CHARS = 500

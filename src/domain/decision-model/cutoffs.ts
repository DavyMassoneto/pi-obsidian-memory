import { DEFAULT_CUTOFFS } from "./constants.ts"
import type { DecisionCutoffs, DecisionProvider } from "./types.ts"

export function defaultCutoffs(provider: DecisionProvider): Partial<DecisionCutoffs> {
  const cutoffs = DEFAULT_CUTOFFS.get(provider)
  if (cutoffs) return cutoffs
  return {}
}

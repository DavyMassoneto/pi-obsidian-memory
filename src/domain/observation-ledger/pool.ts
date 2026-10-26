import { byId } from "./projection.ts"
import type { Ledger, LedgerObservation } from "./types.ts"

export function activeObservations(ledger: Ledger): LedgerObservation[] {
  return ledger.ranges
    .flatMap((range) => range.observations)
    .filter((observation) => !ledger.consolidated.has(observation.id))
    .sort(byId)
}

export function poolTokens(ledger: Ledger): number {
  let total = 0
  for (const observation of activeObservations(ledger)) total += observation.tokens
  return total
}

export function selectPromotion(ledger: Ledger, poolTargetTokens: number): LedgerObservation[] {
  const active = activeObservations(ledger)
  let keptTokens = 0
  let keptCount = 0
  for (const observation of [...active].reverse()) {
    if (keptCount > 0 && keptTokens + observation.tokens > poolTargetTokens) break
    keptTokens += observation.tokens
    keptCount++
  }
  return active.slice(0, active.length - keptCount)
}

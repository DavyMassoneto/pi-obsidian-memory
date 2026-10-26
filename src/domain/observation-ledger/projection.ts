import type { Ledger, LedgerObservation } from "./types.ts"

function byId(left: LedgerObservation, right: LedgerObservation): number {
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

export function compactionObservations(ledger: Ledger, firstKeptIndex: number): LedgerObservation[] {
  return ledger.ranges
    .filter((range) => range.to < firstKeptIndex)
    .flatMap((range) => range.observations)
    .filter((observation) => !ledger.consolidated.has(observation.id))
    .sort(byId)
}

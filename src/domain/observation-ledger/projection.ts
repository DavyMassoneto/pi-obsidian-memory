import { USER_WORDS_ID_SUFFIX } from "./constants.ts"
import type { Ledger, LedgerObservation } from "./types.ts"

function chronologicalId(item: LedgerObservation): string {
  if (typeof item.userEntryIndex !== "number") return item.id
  return item.id.slice(0, item.id.indexOf(".")) + USER_WORDS_ID_SUFFIX
}

export function byId(left: LedgerObservation, right: LedgerObservation): number {
  const first = chronologicalId(left)
  const second = chronologicalId(right)
  if (first < second) return -1
  if (first > second) return 1
  if (typeof left.userEntryIndex === "number" && typeof right.userEntryIndex === "number") {
    return left.userEntryIndex - right.userEntryIndex
  }
  return 0
}

function restoreUserMessageOrder(observations: LedgerObservation[]): void {
  const userSlots = observations.flatMap((observation, slot) => {
    const { userEntryIndex } = observation
    if (typeof userEntryIndex !== "number") return []
    return [{ slot, userEntryIndex, observation }]
  })
  const bySource = userSlots.toSorted((left, right) => left.userEntryIndex - right.userEntryIndex)
  for (const [index, { observation }] of bySource.entries()) {
    const original = userSlots[index]
    if (original) observations[original.slot] = observation
  }
}

export function retainedConsolidated(ledger: Ledger, firstKeptIndex: number): LedgerObservation[] {
  return ledger.ranges
    .filter((range) => range.to < firstKeptIndex)
    .flatMap((range) => range.observations)
    .filter((observation) => typeof observation.userEntryIndex !== "number" && ledger.consolidated.has(observation.id))
    .sort(byId)
}

export function compactionObservations(ledger: Ledger, firstKeptIndex: number): LedgerObservation[] {
  const observations = ledger.ranges
    .filter((range) => range.to < firstKeptIndex)
    .flatMap((range) => range.observations)
    .filter((observation) => typeof observation.userEntryIndex === "number" || !ledger.consolidated.has(observation.id))
    .sort(byId)
  restoreUserMessageOrder(observations)
  return observations
}

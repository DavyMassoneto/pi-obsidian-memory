import type { CoveredRange, Ledger, LedgerObservation, ObservationsRecord, SessionRecord } from "./types.ts"

function observationsRecordsOf(records: SessionRecord[]): ObservationsRecord[] {
  return records.filter((record) => record.kind === "observations")
}

function firstOccurrences(observations: LedgerObservation[], kept: Set<string>): LedgerObservation[] {
  const fresh: LedgerObservation[] = []
  for (const observation of observations) {
    if (kept.has(observation.id)) continue
    kept.add(observation.id)
    fresh.push(observation)
  }
  return fresh
}

export function ledgerOf(records: SessionRecord[]): Ledger {
  const ranges: CoveredRange[] = []
  const used = new Set<string>()
  const kept = new Set<string>()
  for (const record of observationsRecordsOf(records)) {
    const from = records.findIndex((candidate) => candidate.id === record.data.fromId)
    const to = records.findIndex((candidate) => candidate.id === record.data.coversUpToId)
    for (const observation of record.data.observations) used.add(observation.id)
    if (from < 0 || to < from) continue
    ranges.push({ from, to, observations: firstOccurrences(record.data.observations, kept) })
  }
  return { ranges, used, consolidated: new Set<string>(), journey: "" }
}

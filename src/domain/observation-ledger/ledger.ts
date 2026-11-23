import type { ConsolidationMetaRecord, RectifiedOrigins } from "#src/domain/observation-ledger/origin"
import { rectificationKey, rectifiedOrigins, settledObservation } from "./rectify.ts"
import type { CoveredRange, Ledger, LedgerObservation, ObservationsRecord, SavedNote, SessionRecord } from "./types.ts"
import { shortUserText } from "./user-words.ts"
import { UserWordsProjection } from "./user-words-projection.ts"

function firstOccurrences(
  record: ObservationsRecord,
  kept: Map<string, string>,
  origins: RectifiedOrigins,
): LedgerObservation[] {
  const fresh: LedgerObservation[] = []
  for (const observation of record.data.observations) {
    if (kept.has(observation.id)) continue
    kept.set(observation.id, record.id)
    fresh.push(settledObservation(record.id, observation, origins))
  }
  return fresh
}

function coveredRanges(
  records: SessionRecord[],
  used: Set<string>,
  kept: Map<string, string>,
  origins: RectifiedOrigins,
): CoveredRange[] {
  const ranges: CoveredRange[] = []
  for (const record of records) {
    if (record.kind !== "observations") continue
    const from = records.findIndex((candidate) => candidate.id === record.data.fromId)
    const to = records.findIndex((candidate) => candidate.id === record.data.coversUpToId)
    for (const observation of record.data.observations) used.add(observation.id)
    if (from < 0 || to < from) continue
    ranges.push({ from, to, observations: firstOccurrences(record, kept, origins) })
  }
  return ranges
}

function replayUserWordsAndTombstones(
  records: SessionRecord[],
  ranges: CoveredRange[],
  used: Set<string>,
): Set<string> {
  const projection = new UserWordsProjection(used)
  const consolidated = new Set<string>()
  for (const record of records) {
    if (record.kind === "consolidated") {
      for (const id of record.data.observationIds) {
        used.add(id)
        consolidated.add(id)
      }
      continue
    }
    if (record.kind !== "user-words") continue
    const index = records.findIndex((candidate) => candidate.id === record.data.entryId)
    const message = records[index]
    const range = ranges.find((candidate) => candidate.from <= index && index <= candidate.to)
    if (!range || message?.kind !== "message" || message.role !== "user") continue
    if (typeof message.localTime !== "string") continue
    for (const line of projection.from(message.localTime, record.data, shortUserText(message))) {
      range.observations.push({ ...line, userEntryIndex: index })
    }
  }
  return consolidated
}

function metaRecordsOf(records: SessionRecord[]): ConsolidationMetaRecord[] {
  return records.filter((record) => record.kind === "consolidation-meta")
}

function journeyAwareOf(records: ConsolidationMetaRecord[]): Set<string> {
  const aware = new Set<string>()
  for (const record of records) {
    if (!record.data.materialIds) continue
    for (const id of record.data.materialIds) aware.add(id)
  }
  return aware
}

function isPendingCorrection(
  observation: LedgerObservation,
  recordId: string | undefined,
  origins: RectifiedOrigins,
  consolidated: ReadonlySet<string>,
  aware: ReadonlySet<string>,
): boolean {
  if (typeof recordId !== "string" || observation.origin !== "material") return false
  if (!consolidated.has(observation.id) || aware.has(observation.id)) return false
  return origins.has(rectificationKey(recordId, observation.id))
}

function notesToReview(records: ConsolidationMetaRecord[], corrections: LedgerObservation[]): SavedNote[] {
  const pending = new Set(corrections.map((observation) => observation.id))
  const notes: SavedNote[] = []
  for (const record of records) {
    if (!record.data.notes || !record.data.observationIds.some((id) => pending.has(id))) continue
    for (const note of record.data.notes) {
      if (!notes.some((kept) => kept.vault === note.vault && kept.path === note.path)) notes.push(note)
    }
  }
  return notes
}

function journeyOf(records: SessionRecord[]): string {
  let journey = ""
  for (const record of records) {
    if (record.kind === "consolidated") journey = record.data.journey
    if (record.kind === "consolidation-meta" && typeof record.data.journey === "string") journey = record.data.journey
  }
  return journey
}

export function ledgerOf(records: SessionRecord[]): Ledger {
  const origins = rectifiedOrigins(records)
  const used = new Set<string>()
  const kept = new Map<string, string>()
  const ranges = coveredRanges(records, used, kept, origins)
  const consolidated = replayUserWordsAndTombstones(records, ranges, used)
  const metaRecords = metaRecordsOf(records)
  const aware = journeyAwareOf(metaRecords)
  const corrections = ranges
    .flatMap((range) => range.observations)
    .filter((observation) => isPendingCorrection(observation, kept.get(observation.id), origins, consolidated, aware))
  const correctionNotes = notesToReview(metaRecords, corrections)
  return { ranges, used, consolidated, journey: journeyOf(records), corrections, correctionNotes }
}

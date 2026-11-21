import { isCutPoint, isSourceRecord } from "./records.ts"
import type { CutoffSnap, Ledger, SessionRecord } from "./types.ts"

function sourceTokensFrom(records: SessionRecord[], start: number): number {
  let tokens = 0
  for (const record of records.slice(start)) {
    if (isSourceRecord(record)) tokens += record.tokens
  }
  return tokens
}

function nextSourceIndex(records: SessionRecord[], after: number): number {
  for (let index = after + 1; index < records.length; index++) {
    const record = records[index]
    if (record && isSourceRecord(record)) return index
  }
  return -1
}

function firstUncoveredSource(records: SessionRecord[], ledger: Ledger): number {
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record || !isSourceRecord(record)) continue
    if (!ledger.ranges.some((range) => range.from <= index && index <= range.to)) return index
  }
  return records.length
}

function boundariesOf(records: SessionRecord[], ledger: Ledger): number[] {
  const limit = firstUncoveredSource(records, ledger)
  const boundaries = ledger.ranges.map((range) => range.to).filter((boundary) => boundary < limit)
  return [...new Set(boundaries)].sort((left, right) => left - right)
}

export function snapCutoff(records: SessionRecord[], ledger: Ledger, tailTokens: number): CutoffSnap | null {
  let best: CutoffSnap | null = null
  for (const boundary of boundariesOf(records, ledger)) {
    const firstKeptIndex = nextSourceIndex(records, boundary)
    const firstKept = records[firstKeptIndex]
    if (!firstKept || !isCutPoint(firstKept)) continue
    const tail = sourceTokensFrom(records, firstKeptIndex)
    if (!best || Math.abs(tail - tailTokens) < Math.abs(best.tail - tailTokens)) {
      best = { firstKeptEntryId: firstKept.id, firstKeptIndex, tail }
    }
  }
  return best
}

export function idealCutId(records: SessionRecord[], tailTokens: number): string | null {
  let tail = 0
  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index]
    if (!record || !isSourceRecord(record)) continue
    tail += record.tokens
    if (tail < tailTokens || !isCutPoint(record)) continue
    if (records.slice(0, index).some(isSourceRecord)) return record.id
    return null
  }
  return null
}

export function rawTokensSinceLastCompaction(records: SessionRecord[]): number {
  const compactionIndex = records.findLastIndex((record) => record.kind === "compaction")
  const compaction = records[compactionIndex]
  if (compaction?.kind !== "compaction") return sourceTokensFrom(records, 0)
  const firstKeptIndex = records.findIndex((record) => record.id === compaction.firstKeptEntryId)
  if (firstKeptIndex < 0) return sourceTokensFrom(records, compactionIndex + 1)
  return sourceTokensFrom(records, firstKeptIndex)
}

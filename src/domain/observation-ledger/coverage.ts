import { isSourceRecord } from "./records.ts"
import type { ChunkRange, IndexRange, Ledger, SessionRecord, Span } from "./types.ts"

function indexRangeOf(records: SessionRecord[], range: ChunkRange): IndexRange {
  return {
    from: records.findIndex((record) => record.id === range.fromId),
    to: records.findIndex((record) => record.id === range.coversUpToId),
  }
}

function isCovered(index: number, ranges: IndexRange[]): boolean {
  return ranges.some((range) => index >= range.from && index <= range.to)
}

export function uncoveredSpans(records: SessionRecord[], ledger: Ledger, inFlight: ChunkRange[]): Span[] {
  const ranges: IndexRange[] = [...ledger.ranges, ...inFlight.map((range) => indexRangeOf(records, range))]
  const runs: IndexRange[] = []
  let current: IndexRange | null = null
  for (const [index, record] of records.entries()) {
    if (!isSourceRecord(record)) continue
    if (isCovered(index, ranges)) {
      current = null
      continue
    }
    if (current) {
      current.to = index
      continue
    }
    current = { from: index, to: index }
    runs.push(current)
  }
  return runs.map((run) => ({ ...run, closed: ranges.some((range) => range.from > run.to) }))
}

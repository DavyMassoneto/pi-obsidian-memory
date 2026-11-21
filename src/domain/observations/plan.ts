import type { ObservationPlannerSettings, ObservationSlice, SourceEntry } from "./types.ts"

export function planObservationSlices(
  entries: SourceEntry[],
  confirmedIds: string[],
  reservedIds: string[],
  settings: ObservationPlannerSettings,
  flush: boolean,
): ObservationSlice[] {
  const unavailable = new Set([...confirmedIds, ...reservedIds])
  const slices: ObservationSlice[] = []
  let cursor = 0
  while (cursor < entries.length && slices.length < settings.maxSlices) {
    const first = entries[cursor]
    if (!first || unavailable.has(first.id)) {
      cursor += 1
      continue
    }
    const end = sliceEnd(entries, cursor, unavailable, settings.chunkTokens)
    const selected = entries.slice(cursor, end)
    const tokens = selected.reduce((sum, entry) => sum + entry.tokenCount, 0)
    if (flush || tokens >= settings.chunkTokens)
      slices.push({ entries: selected, contextEntries: contextBefore(entries, cursor, settings.chunkOverlapTokens) })
    cursor = end
  }
  return slices
}

function sliceEnd(entries: SourceEntry[], start: number, unavailable: Set<string>, chunkTokens: number): number {
  let cursor = start
  let tokens = 0
  while (cursor < entries.length) {
    const entry = entries[cursor]
    if (!entry || unavailable.has(entry.id)) break
    if (tokens >= chunkTokens && entry.canStartKeptRange) break
    tokens += entry.tokenCount
    cursor += 1
  }
  return cursor
}

function contextBefore(entries: SourceEntry[], start: number, overlapTokens: number): SourceEntry[] {
  if (overlapTokens <= 0) return []
  let cursor = start
  let tokens = 0
  while (cursor > 0 && tokens < overlapTokens) {
    cursor -= 1
    const entry = entries[cursor]
    if (entry) tokens += entry.tokenCount
  }
  while (cursor > 0 && !entries[cursor]?.canStartKeptRange) cursor -= 1
  return entries.slice(cursor, start)
}

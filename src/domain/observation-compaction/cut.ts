import type { SourceEntry } from "#src/domain/observations"

export function selectCoveredCut(entries: SourceEntry[], confirmedIds: string[], tailTokens: number): string | null {
  const confirmed = new Set(confirmedIds)
  let covered = 0
  for (const entry of entries) {
    if (!confirmed.has(entry.id)) break
    covered += 1
  }
  let keepFrom = entries.length
  let retainedTokens = 0
  while (keepFrom > 0 && retainedTokens < tailTokens) {
    keepFrom -= 1
    const entry = entries[keepFrom]
    if (entry) retainedTokens += entry.tokenCount
  }
  const latestCut = Math.min(keepFrom, covered, entries.length - 1)
  for (let index = latestCut; index > 0; index -= 1) {
    const entry = entries[index]
    if (entry?.canStartKeptRange) return entry.id
  }
  return null
}

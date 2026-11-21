import type { ObservationCommit, SourceEntry } from "./types.ts"

export function confirmedSourceIds(entries: SourceEntry[], commits: ObservationCommit[]): string[] {
  const branchIds = new Set(entries.map((entry) => entry.id))
  const branchCommits = commits.filter((commit) => commit.sourceEntryIds.every((id) => branchIds.has(id)))
  return [...new Set(branchCommits.flatMap((commit) => commit.sourceEntryIds))]
}

export function confirmedPrefix(entries: SourceEntry[], commits: ObservationCommit[]): string[] {
  const confirmed = new Set(confirmedSourceIds(entries, commits))
  const prefix: string[] = []
  for (const entry of entries) {
    if (!confirmed.has(entry.id)) break
    prefix.push(entry.id)
  }
  return prefix
}

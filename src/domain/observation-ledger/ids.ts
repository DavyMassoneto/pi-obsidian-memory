import { textTokens } from "./tokens.ts"
import type { ChunkRange, ObservationsRecorded, ObserverDraft, StoredObservation } from "./types.ts"

function baseId(timestamp: string): string {
  return `${timestamp.replace(" ", "T")}:00`
}

function freeId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base
  let suffix = 1
  while (taken.has(`${base}.${String(suffix).padStart(2, "0")}`)) suffix++
  return `${base}.${String(suffix).padStart(2, "0")}`
}

export function assignObservationIds(drafts: ObserverDraft[], used: ReadonlySet<string>): StoredObservation[] {
  const taken = new Set(used)
  const observations: StoredObservation[] = []
  for (const draft of drafts) {
    const id = freeId(baseId(draft.timestamp), taken)
    taken.add(id)
    observations.push({ id, content: draft.content, tokens: textTokens(draft.content) })
  }
  return observations
}

export function recordedData(range: ChunkRange, observations: StoredObservation[]): ObservationsRecorded {
  return { fromId: range.fromId, coversUpToId: range.coversUpToId, observations }
}

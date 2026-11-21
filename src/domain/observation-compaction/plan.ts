import { confirmedSourceIds, foldObservations } from "#src/domain/observations"
import { selectCoveredCut } from "./cut.ts"
import { renderObservationSummary } from "./summary.ts"
import type { ObservationCompactionInput, ObservationCompactionPlan } from "./types.ts"

export function planObservationCompaction(input: ObservationCompactionInput): ObservationCompactionPlan | null {
  const confirmed = confirmedSourceIds(input.sources, input.commits)
  const firstKeptEntryId = selectCoveredCut(input.sources, confirmed, input.tailTokens)
  if (!firstKeptEntryId) return null
  const cutIndex = input.sources.findIndex((entry) => entry.id === firstKeptEntryId)
  const removed = new Set(input.sources.slice(0, cutIndex).map((entry) => entry.id))
  const observations = foldObservations(input.commits, []).filter((item) =>
    item.sourceEntryIds.every((id) => removed.has(id)),
  )
  const summary = renderObservationSummary({ observations, memoryMap: input.memoryMap })
  if (summary === "") return null
  return { firstKeptEntryId, summary }
}

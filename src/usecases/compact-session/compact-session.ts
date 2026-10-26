import { compactionObservations, ledgerOf, renderCompactionSummary, renderMemoryMap, snapCutoff } from "#src/services"
import { loadMemoryMap } from "#src/usecases/load-memory-map"
import { cycleSettings } from "#src/usecases/observe-session"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { NOT_OBSERVED } from "./constants.ts"
import type { CompactSessionRequest, CompactSessionResult } from "./types.ts"

export async function compactSession(
  request: CompactSessionRequest,
  context: MemoryOperationContext,
): Promise<CompactSessionResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { tailTokens, mapTokens } = settings.output.compaction
  const ledger = ledgerOf(request.records)
  const snap = snapCutoff(request.records, ledger, tailTokens)
  if (!snap) return { succeeded: false, reason: "not-observed", problems: [NOT_OBSERVED] }
  const vaults = await loadMemoryMap(context)
  if (!vaults.succeeded) return vaults
  const summary = renderCompactionSummary({
    journey: ledger.journey,
    map: renderMemoryMap(vaults.output, mapTokens),
    observations: compactionObservations(ledger, snap.firstKeptIndex),
  })
  return { succeeded: true, output: { summary, firstKeptEntryId: snap.firstKeptEntryId } }
}

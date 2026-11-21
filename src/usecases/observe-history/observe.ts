import { type CompletionPort, materializeObservations, runObserverModel } from "#src/services"
import type { ObserveHistoryInput, ObserveHistoryResult } from "./types.ts"

export async function observeHistory(
  input: ObserveHistoryInput,
  complete: CompletionPort,
): Promise<ObserveHistoryResult> {
  if (input.signal.aborted) return { succeeded: false, problems: ["Observation aborted"] }
  const entries = structuredClone(input.entries)
  const request = { ...input, entries }
  if (input.contextEntries) request.contextEntries = structuredClone(input.contextEntries)
  const result = await runObserverModel(request, complete)
  if (!result.succeeded) return result
  if (input.signal.aborted) return { succeeded: false, problems: ["Observation aborted"] }
  return {
    succeeded: true,
    output: materializeObservations(
      entries.map((entry) => entry.id),
      result.output,
    ),
  }
}

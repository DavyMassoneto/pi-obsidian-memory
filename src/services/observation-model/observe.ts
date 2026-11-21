import { parseObserverReply } from "#src/domain"
import { type CompletionPort, completeStep, completionRequest } from "#src/services/llm"
import { OBSERVER_POLICY } from "./constants.ts"
import type { ObserveModelInput, ObserveModelResult } from "./types.ts"

export async function runObserverModel(
  input: ObserveModelInput,
  complete: CompletionPort,
): Promise<ObserveModelResult> {
  const sourceIds = input.entries.map((entry) => entry.id)
  if (sourceIds.length === 0 || sourceIds.some((id) => !id.trim()) || new Set(sourceIds).size !== sourceIds.length)
    return { succeeded: false, problems: ["An observed slice requires distinct nonempty source IDs"] }
  const data = JSON.stringify({
    entries: input.entries.map((entry) => ({ id: entry.id, text: entry.text })),
    contextEntries: input.contextEntries?.map((entry) => ({ id: entry.id, text: entry.text })),
  })
  const result = await completeStep(completionRequest(input, { system: OBSERVER_POLICY, data }), complete)
  if (!result.succeeded) return result
  return parseObserverReply(result.output, sourceIds)
}

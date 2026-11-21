import { type CompletionPort, journeyStep, localTimestamp, nowMs } from "#src/services"
import { captureMemory } from "#src/usecases/capture-memory"
import { cycleSettings } from "#src/usecases/observe-session"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { ConsolidateSessionRequest, ConsolidateSessionResult } from "./types.ts"

export async function consolidateSession(
  request: ConsolidateSessionRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<ConsolidateSessionResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { model, thinking, journeyTokens } = settings.output.consolidator
  const material = request.observations.map((observation) => ({ label: observation.id, text: observation.content }))
  const captured = await captureMemory(
    { kind: "consolidate", material, model, thinking, explicitSaves: request.saved },
    context,
    complete,
  )
  if (!captured.succeeded) return captured
  const journey = await journeyStep(
    {
      signal: context.signal,
      model,
      thinking,
      journey: request.journey,
      material,
      targetTokens: journeyTokens,
      now: localTimestamp(nowMs()),
    },
    complete,
  )
  if (!journey.succeeded) {
    const report = captured.output
    if (memoryOperationInterruption(context)) {
      return { succeeded: false, reason: "interrupted", problems: journey.problems, report }
    }
    return { succeeded: false, reason: "model-failed", problems: journey.problems, report }
  }
  return { succeeded: true, output: { applied: captured.output.applied, journey: journey.output } }
}

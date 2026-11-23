import {
  attributionStep,
  CHARS_PER_TOKEN,
  type CompletionPort,
  closedOrigins,
  falseAttributions,
  materialSources,
  mergedOrigins,
  rectifiedData,
  repairedObservations,
  repairStep,
  type UserWordsCheck,
  unconfirmedCheck,
  userWordsStep,
} from "#src/services"
import { cycleSettings } from "#src/usecases/observe-session"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { REPAIR_ATTEMPTS } from "./constants.ts"
import type {
  ExtractUserWordsResult,
  RepairAttributionRequest,
  VerifyAttributionRequest,
  VerifyAttributionResult,
} from "./types.ts"

export async function verifyAttribution(
  request: VerifyAttributionRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<VerifyAttributionResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { check } = request
  const { model, thinking } = settings.output.observer
  const step = { signal: context.signal, model, thinking }
  const origins = await attributionStep({ ...step, check }, complete)
  if (!origins.succeeded) return origins
  let observations = origins.output
  const open = unconfirmedCheck(check, observations)
  if (open) {
    const again = await attributionStep({ ...step, check: open }, complete)
    if (again.succeeded) observations = mergedOrigins(observations, again.output)
  }
  return { succeeded: true, output: rectifiedData(check, observations) }
}

export async function extractUserWords(
  check: UserWordsCheck,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<ExtractUserWordsResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { model, thinking } = settings.output.observer
  return userWordsStep({ signal: context.signal, model, thinking, check }, complete)
}

export async function repairAttribution(
  request: RepairAttributionRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<VerifyAttributionResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { records, check } = request
  const { model, thinking, chunkTokens } = settings.output.observer
  const sources = materialSources(records, check, chunkTokens * CHARS_PER_TOKEN)
  let observations = request.origins
  for (const _attempt of REPAIR_ATTEMPTS) {
    const wrong = falseAttributions(check, observations)
    if (wrong.length === 0) break
    const repairs = await repairStep(
      { signal: context.signal, model, thinking, sources, observations: wrong },
      complete,
    )
    if (!repairs.succeeded && "modelCall" in repairs) return repairs
    if (repairs.succeeded) observations = repairedObservations(sources, observations, repairs.output)
  }
  return { succeeded: true, output: rectifiedData(check, closedOrigins(observations)) }
}

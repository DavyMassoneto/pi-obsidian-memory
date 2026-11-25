import {
  applyWorkState,
  type CompletionPort,
  captureMaterial,
  correctionMaterial,
  journeyMaterial,
  journeyStep,
  localTimestamp,
  nowMs,
} from "#src/services"
import { type CaptureReport, captureMemory } from "#src/usecases/capture-memory"
import { cycleSettings } from "#src/usecases/observe-session"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import { changedNotes } from "./notes.ts"
import type { ConsolidateSessionRequest, ConsolidateSessionResult, ConsolidationCapture } from "./types.ts"

function captureOf(request: ConsolidateSessionRequest): ConsolidationCapture {
  return {
    kind: "consolidate",
    material: [
      ...captureMaterial(request.observations),
      ...correctionMaterial(request.corrections, request.correctionNotes),
    ],
    explicitSaves: [...request.saved, ...request.correctionNotes, ...request.owedNotes],
    onApplied: request.onApplied,
  }
}

export async function consolidateSession(
  request: ConsolidateSessionRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<ConsolidateSessionResult> {
  const settings = await cycleSettings(context)
  if (!settings.succeeded) return settings
  const { model, thinking, journeyTokens } = settings.output.consolidator
  let report: CaptureReport = { reviewed: false, applied: [] }
  if (settings.output.vaultConfigured) {
    const captured = await captureMemory({ ...captureOf(request), model, thinking }, context, complete)
    if (captured.succeeded) report = captured.output
    else if (captured.reason !== "invalid-config") return captured
  }
  const material = journeyMaterial(request.observations)
  const corrections = journeyMaterial(request.corrections)
  const journey = await journeyStep(
    {
      signal: context.signal,
      model,
      thinking,
      journey: request.journey,
      workState: request.workState,
      material,
      corrections,
      targetTokens: journeyTokens,
      now: localTimestamp(nowMs()),
    },
    complete,
  )
  if (!journey.succeeded) {
    if (memoryOperationInterruption(context)) {
      return { succeeded: false, reason: "interrupted", problems: journey.problems, report }
    }
    return { succeeded: false, reason: "model-failed", problems: journey.problems, report }
  }
  const { applied } = report
  const notes = changedNotes(applied, request.owedNotes)
  const workState = applyWorkState(request.workState, journey.output.workState, material, corrections)
  return { succeeded: true, output: { applied, notes, journey: journey.output.journey, workState } }
}

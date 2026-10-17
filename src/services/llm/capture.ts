import { Value } from "typebox/value"

import { CaptureActionSchema, CaptureInputSchema, parseCaptureAction } from "#src/domain"
import { checkStep, completeStep, completionRequest, modelCallFailure } from "./complete.ts"
import { CAPTURE_POLICY, DATA_POLICY } from "./constants.ts"
import type { CaptureRequest, CaptureStepResult, CompletionPort } from "./types.ts"

export async function captureStep(request: CaptureRequest, complete: CompletionPort): Promise<CaptureStepResult> {
  const { context, transcriptDelta, observations, explicitSaves, limits } = request
  const input = { context, transcriptDelta, observations, explicitSaves, limits }
  if (!Value.Check(CaptureInputSchema, input)) return modelCallFailure("Invalid capture input")
  const snapshot = structuredClone(input)
  const data = JSON.stringify(snapshot)
  const refused = checkStep(request, data)
  if (refused) return refused
  const system = `${DATA_POLICY}\n${CAPTURE_POLICY}\nAction schema: ${JSON.stringify(CaptureActionSchema)}`
  const result = await completeStep(completionRequest(request, { system, data }), complete)
  if (!result.succeeded) return result
  return parseCaptureAction(result.output, snapshot)
}

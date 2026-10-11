import { Value } from "typebox/value"

import { CaptureActionSchema, CaptureInputSchema, type CaptureResult, parseCaptureAction } from "#/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { CAPTURE_POLICY, DATA_POLICY, MAX_CAPTURE_DURATION_MS } from "./constants.ts"
import type { CaptureRequest, CompletionPort } from "./types.ts"

export async function captureStep(request: CaptureRequest, complete: CompletionPort): Promise<CaptureResult> {
  const { context, transcriptDelta, observations, explicitSaves, limits } = request
  const input = { context, transcriptDelta, observations, explicitSaves, limits }
  if (!Value.Check(CaptureInputSchema, input)) return { succeeded: false, problems: ["Invalid capture input"] }
  const snapshot = structuredClone(input)
  const data = JSON.stringify(snapshot)
  const problems = checkStep(request, data)
  if (problems.length > 0) return { succeeded: false, problems }
  const system = `${DATA_POLICY}\n${CAPTURE_POLICY}\nAction schema: ${JSON.stringify(CaptureActionSchema)}`
  const result = await completeStep(completionRequest(request, { system, data }), complete, MAX_CAPTURE_DURATION_MS)
  if (!result.succeeded) return result
  return parseCaptureAction(result.output, snapshot)
}

import { CaptureActionSchema, captureInputProblems, parseCaptureAction } from "#src/domain"
import { checkStep, completeStep, completionRequest, modelCallFailure } from "./complete.ts"
import { CAPTURE_POLICY, DATA_POLICY } from "./constants.ts"
import type { CaptureRequest, CaptureStepResult, CompletionPort } from "./types.ts"

export async function captureStep(request: CaptureRequest, complete: CompletionPort): Promise<CaptureStepResult> {
  const { context, transcriptDelta, observations, explicitSaves, limits } = request
  const input = { context, transcriptDelta, observations, explicitSaves, limits }
  const problems = captureInputProblems(input)
  if (problems.length > 0) return modelCallFailure(`Invalid capture input: ${problems.join("; ")}`)
  const snapshot = structuredClone(input)
  const data = JSON.stringify(snapshot)
  const refused = checkStep(request)
  if (refused) return refused
  const system = `${DATA_POLICY}\n${CAPTURE_POLICY}\nAction schema: ${JSON.stringify(CaptureActionSchema)}`
  const result = await completeStep(completionRequest(request, { system, data }), complete)
  if (!result.succeeded) return result
  return parseCaptureAction(result.output, snapshot)
}

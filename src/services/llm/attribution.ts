import { type AttributionCheck, parseAttributionReply, verifiedOrigins } from "#src/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { ATTRIBUTION_POLICY } from "./constants.ts"
import type { AttributionRequest, AttributionStepResult, CompletionPort, CompletionRequest } from "./types.ts"

export function attributionData(check: AttributionCheck): string {
  const { userEntryIds, userMessages, materialSources, observations } = check
  return JSON.stringify({ userEntryIds, userMessages, materialSources, observations })
}

export function attributionRequest(request: AttributionRequest): CompletionRequest {
  const prompt = { system: ATTRIBUTION_POLICY, data: attributionData(request.check) }
  return { ...completionRequest(request, prompt), thinking: request.thinking }
}

export async function attributionStep(
  request: AttributionRequest,
  complete: CompletionPort,
): Promise<AttributionStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(attributionRequest(request), complete)
  if (!result.succeeded) return result
  const verdicts = parseAttributionReply(result.output)
  if (!verdicts.succeeded) return verdicts
  return verifiedOrigins(request.check, verdicts.output)
}

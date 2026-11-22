import { parseJourneyReply } from "#src/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { JOURNEY_POLICY, WORDS_PER_TOKEN } from "./constants.ts"
import type { CompletionPort, CompletionRequest, JourneyRequest, JourneyStepResult } from "./types.ts"

export function journeyData(request: JourneyRequest): string {
  return JSON.stringify({
    now: request.now.slice(0, 16).replace("T", " "),
    journey: request.journey,
    journeyTokens: request.targetTokens,
    journeyWords: Math.round(request.targetTokens * WORDS_PER_TOKEN),
    material: request.material,
    corrections: request.corrections,
  })
}

export function journeyRequest(request: JourneyRequest): CompletionRequest {
  const prompt = { system: JOURNEY_POLICY, data: journeyData(request) }
  return { ...completionRequest(request, prompt), thinking: request.thinking }
}

export async function journeyStep(request: JourneyRequest, complete: CompletionPort): Promise<JourneyStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(journeyRequest(request), complete)
  if (!result.succeeded) return result
  return parseJourneyReply(result.output)
}

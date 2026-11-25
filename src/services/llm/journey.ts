import { parseJourneyReply } from "#src/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { JOURNEY_POLICY, WORDS_PER_TOKEN } from "./constants.ts"
import type { CompletionPort, CompletionRequest, JourneyRequest, JourneyStepResult } from "./types.ts"

export function journeyData(request: JourneyRequest): string {
  return JSON.stringify({
    now: request.now.slice(0, 16).replace("T", " "),
    journey: request.journey,
    workState: request.workState.map((item, index) => ({ index, ...item })),
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
  const prompt = journeyRequest(request)
  const result = await completeStep(prompt, complete)
  if (!result.succeeded) return result
  const parsed = parseJourneyReply(result.output)
  if (parsed.succeeded) return parsed
  const retry = await completeStep(
    {
      ...prompt,
      system: `${prompt.system}\nThe previous reply was invalid (${parsed.problems.join("; ")}). Send a fresh JSON object. Escape newlines inside strings as \\n and escape double quotes inside strings. Do not wrap the object in Markdown.`,
    },
    complete,
  )
  if (!retry.succeeded) return retry
  return parseJourneyReply(retry.output)
}

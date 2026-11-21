import { parseObserverReply } from "#src/domain"
import { checkStep, completeStep } from "./complete.ts"
import {
  OBSERVER_DATA_BEGIN,
  OBSERVER_DATA_CLOSING,
  OBSERVER_DATA_END,
  OBSERVER_DATA_INTRO,
  OBSERVER_DATA_TIME_LABEL,
  OBSERVER_PROMPT,
} from "./constants.ts"
import type { CompletionPort, CompletionRequest, ObserveRequest, ObserveStepResult } from "./types.ts"

export function observerData(chunk: string, now: string): string {
  const minute = now.slice(0, 16).replace("T", " ")
  return [
    `${OBSERVER_DATA_TIME_LABEL} ${minute}`,
    OBSERVER_DATA_INTRO,
    `${OBSERVER_DATA_BEGIN}\n${chunk}\n${OBSERVER_DATA_END}`,
    OBSERVER_DATA_CLOSING,
  ].join("\n\n")
}

export function observerRequest(request: ObserveRequest): CompletionRequest {
  return {
    model: { ...request.model },
    signal: request.signal,
    system: OBSERVER_PROMPT,
    data: observerData(request.chunk, request.now),
    thinking: request.thinking,
  }
}

export async function observeStep(request: ObserveRequest, complete: CompletionPort): Promise<ObserveStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(observerRequest(request), complete)
  if (!result.succeeded) return result
  return parseObserverReply(result.output)
}

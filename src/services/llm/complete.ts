import { Value } from "typebox/value"

import {
  MAX_MODEL_INPUT_CHARS,
  MAX_MODEL_OUTPUT_TOKENS,
  MAX_MODEL_RESPONSE_CHARS,
  MAX_MODEL_ROUNDS,
} from "./constants.ts"
import { completionLifetime } from "./lifetime.ts"
import { CompletionResponseSchema } from "./schemas.ts"
import type { CompletionPort, CompletionRequest, CompletionResult, ModelStepContext, PromptContent } from "./types.ts"

export async function completeStep(
  request: CompletionRequest,
  complete: CompletionPort,
  duration: number,
): Promise<CompletionResult> {
  const lifetime = completionLifetime(request, duration)
  try {
    const response = await Promise.race([complete({ ...request, signal: lifetime.signal }), lifetime.stopped])
    if (lifetime.signal.aborted || Date.now() >= request.deadline) {
      return { succeeded: false, problems: ["Model request aborted or expired"] }
    }
    if (!Value.Check(CompletionResponseSchema, response) || response.status !== "completed") {
      return { succeeded: false, problems: ["Model returned no completed text"] }
    }
    if (response.text.trim().length === 0 || response.text.length > MAX_MODEL_RESPONSE_CHARS) {
      return { succeeded: false, problems: ["Model response is empty or exceeds the response bound"] }
    }
    return { succeeded: true, output: response.text }
  } catch {
    return { succeeded: false, problems: ["Model completion failed"] }
  } finally {
    lifetime.dispose()
  }
}

export function checkStep(context: ModelStepContext, data: string): string[] {
  if (context.signal.aborted || !Number.isFinite(context.deadline) || context.deadline <= Date.now()) {
    return ["Model request aborted or expired"]
  }
  if (!Number.isInteger(context.round) || context.round < 1 || context.round > MAX_MODEL_ROUNDS) {
    return ["Model round must be between 1 and 8"]
  }
  if (!context.model.provider.trim() || !context.model.id.trim()) return ["An explicit model is required"]
  if (data.length > MAX_MODEL_INPUT_CHARS) return ["Model input exceeds the input bound"]
  return []
}

export function completionRequest(context: ModelStepContext, prompt: PromptContent): CompletionRequest {
  return {
    model: { ...context.model },
    signal: context.signal,
    deadline: context.deadline,
    round: context.round,
    maxRounds: MAX_MODEL_ROUNDS,
    maxTokens: MAX_MODEL_OUTPUT_TOKENS,
    system: `${prompt.system}\nRound ${context.round} of ${MAX_MODEL_ROUNDS}.`,
    data: `<MEMORY_DATA>\n${prompt.data.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}\n</MEMORY_DATA>`,
  }
}

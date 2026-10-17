import { Value } from "typebox/value"

import { MAX_MODEL_INPUT_CHARS, MAX_MODEL_OUTPUT_TOKENS, MAX_MODEL_RESPONSE_CHARS } from "./constants.ts"
import { completionLifetime } from "./lifetime.ts"
import { CompletionResponseSchema } from "./schemas.ts"
import type {
  CompletionPort,
  CompletionRequest,
  CompletionResult,
  FailedResponse,
  ModelCallFailure,
  ModelStepContext,
  PromptContent,
} from "./types.ts"

export async function completeStep(request: CompletionRequest, complete: CompletionPort): Promise<CompletionResult> {
  const lifetime = completionLifetime(request.signal)
  try {
    const response = await Promise.race([complete({ ...request, signal: lifetime.signal }), lifetime.stopped])
    if (lifetime.signal.aborted) return modelCallFailure("Model request aborted")
    if (!Value.Check(CompletionResponseSchema, response))
      return modelCallFailure("Model call returned an unreadable reply")
    if (response.status !== "completed") return modelCallFailure(failedCallText(response))
    if (response.text.trim().length === 0) return modelCallFailure("Model call returned no text")
    if (response.text.length > MAX_MODEL_RESPONSE_CHARS) {
      return { succeeded: false, problems: ["Model response exceeds the response bound"] }
    }
    return { succeeded: true, output: response.text }
  } catch (error) {
    if (error instanceof Error) return modelCallFailure(`Model call failed: ${error.message}`)
    return modelCallFailure("Model call failed")
  } finally {
    lifetime.dispose()
  }
}

export function checkStep(context: ModelStepContext, data: string): ModelCallFailure | null {
  if (context.signal.aborted) return modelCallFailure("Model request aborted")
  if (!context.model.provider.trim() || !context.model.id.trim()) {
    return modelCallFailure("An explicit model is required")
  }
  if (data.length > MAX_MODEL_INPUT_CHARS) return modelCallFailure("Model input exceeds the input bound")
  return null
}

export function modelCallFailure(problem: string): ModelCallFailure {
  return { succeeded: false, modelCall: true, problems: [problem] }
}

function failedCallText(response: FailedResponse): string {
  if (typeof response.error === "string") return `Model call ${response.status}: ${response.error}`
  return `Model call ${response.status}`
}

export function completionRequest(context: ModelStepContext, prompt: PromptContent): CompletionRequest {
  return {
    model: { ...context.model },
    signal: context.signal,
    maxTokens: MAX_MODEL_OUTPUT_TOKENS,
    system: prompt.system,
    data: `<MEMORY_DATA>\n${prompt.data.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}\n</MEMORY_DATA>`,
  }
}

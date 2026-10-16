import type { DecisionResult } from "#src/domain"
import { layaNoulLabels } from "./constants.ts"
import { layaHttpFailure } from "./laya-http-failure.ts"
import { readLayaResponse } from "./laya-response.ts"
import type { DecisionPrompt, LayaContext, ProviderCall } from "./types.ts"

export function layaNativeQuestions(prompt: DecisionPrompt) {
  const questions = prompt.questions
  if ("needed" in questions) return { needed: { ...questions.needed, type: "noul", labels: layaNoulLabels } }
  return { relevant: { ...questions.relevant, type: "noul" } }
}

export function layaHeaders(context: LayaContext): Headers {
  const headers = new Headers({ "content-type": "application/json" })
  if (context.apiKey) headers.set("authorization", `Bearer ${context.apiKey}`)
  return headers
}

export async function classifyLaya(context: LayaContext, call: ProviderCall): Promise<DecisionResult> {
  const response = await fetch(context.endpoint, {
    method: "POST",
    headers: layaHeaders(context),
    signal: call.signal,
    redirect: "manual",
    body: JSON.stringify({
      model: context.model,
      state: call.prompt.state,
      questions: layaNativeQuestions(call.prompt),
      max_len: context.maxTokens,
      head_max_len: context.headMaxTokens,
    }),
  })
  if (!response.ok) return layaHttpFailure(response, call.diagnostics)
  return readLayaResponse({ response, question: call.question, diagnostics: call.diagnostics })
}

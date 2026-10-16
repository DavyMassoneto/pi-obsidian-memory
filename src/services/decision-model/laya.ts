import type { DecisionResult } from "#src/domain"
import { readLayaResponse } from "./laya-response.ts"
import type { LayaContext, ProviderCall } from "./types.ts"

function nativeQuestions(call: ProviderCall) {
  const questions = call.prompt.questions
  if ("needed" in questions) return { needed: { ...questions.needed, type: "noul" } }
  return { relevant: { ...questions.relevant, type: "noul" } }
}

export async function classifyLaya(context: LayaContext, call: ProviderCall): Promise<DecisionResult> {
  const headers = new Headers({ "content-type": "application/json" })
  if (context.apiKey) headers.set("authorization", `Bearer ${context.apiKey}`)
  const response = await fetch(context.endpoint, {
    method: "POST",
    headers,
    signal: call.signal,
    redirect: "manual",
    body: JSON.stringify({
      model: context.model,
      state: call.prompt.state,
      questions: nativeQuestions(call),
      max_len: context.maxTokens,
      head_max_len: context.headMaxTokens,
    }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    return { succeeded: false, code: "http-error", httpStatus: response.status, diagnostics: call.diagnostics }
  }
  return readLayaResponse({ response, question: call.question, diagnostics: call.diagnostics })
}

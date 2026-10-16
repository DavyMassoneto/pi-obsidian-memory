import { Value } from "typebox/value"

import type { DecisionFailureCode, DecisionResult } from "#src/domain"
import { layaServeMaxBatchStates, maxLayaBatchResponseBytes } from "./constants.ts"
import { layaHeaders, layaNativeQuestions } from "./laya.ts"
import { layaHttpFailures } from "./laya-http-failure.ts"
import { interpretLayaValue, readBoundedText } from "./laya-response.ts"
import { LayaBatchResponseSchema } from "./schemas.ts"
import type { DecisionBatchItem, LayaBatchCall, LayaContext, LayaResultCandidate } from "./types.ts"

function failAll(items: DecisionBatchItem[], code: DecisionFailureCode): DecisionResult[] {
  return items.map((item) => ({ succeeded: false, code, diagnostics: item.diagnostics }))
}

async function readResults(response: Response): Promise<LayaResultCandidate[] | null> {
  const text = await readBoundedText(response, maxLayaBatchResponseBytes)
  if (typeof text !== "string") return null
  try {
    const parsed = JSON.parse(text)
    if (!Value.Check(LayaBatchResponseSchema, parsed)) return null
    return parsed.results
  } catch {
    return null
  }
}

async function classifyChunk(context: LayaContext, items: DecisionBatchItem[], signal: AbortSignal) {
  const first = items[0]
  if (!first) return []
  const response = await fetch(`${context.endpoint}/batch`, {
    method: "POST",
    headers: layaHeaders(context),
    signal,
    redirect: "manual",
    body: JSON.stringify({
      model: context.model,
      states: items.map((item) => item.prompt.state),
      questions: layaNativeQuestions(first.prompt),
      max_len: context.maxTokens,
      head_max_len: context.headMaxTokens,
    }),
  })
  if (!response.ok)
    return layaHttpFailures(
      response,
      items.map((item) => item.diagnostics),
    )
  const results = await readResults(response)
  if (!results || results.length !== items.length) return failAll(items, "invalid-response")
  return items.map((item, index): DecisionResult => {
    const value = results[index]
    if (!value) return { succeeded: false, code: "invalid-response", diagnostics: item.diagnostics }
    return interpretLayaValue(value, { question: "relevant", diagnostics: item.diagnostics })
  })
}

export async function classifyLayaBatch(context: LayaContext, call: LayaBatchCall): Promise<DecisionResult[]> {
  const results: DecisionResult[] = []
  for (let start = 0; start < call.items.length; start += layaServeMaxBatchStates) {
    const chunk = call.items.slice(start, start + layaServeMaxBatchStates)
    results.push(...(await classifyChunk(context, chunk, call.signal)))
  }
  return results
}

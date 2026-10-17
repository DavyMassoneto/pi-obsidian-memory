import type { CandidateDecisionRequest, DecisionResult } from "#src/domain"
import { initialDiagnostics } from "./diagnostics.ts"
import { interruptible } from "./interruption.ts"
import { classifyJevSettled } from "./jev.ts"
import { classifyLayaBatch } from "./laya-batch.ts"
import { decisionPreflight } from "./preflight.ts"
import { candidatePrompt } from "./prompts.ts"
import type { DecisionBatchItem, DecisionContext } from "./types.ts"

function runBatch(context: DecisionContext, items: DecisionBatchItem[], signal: AbortSignal) {
  if (context.provider === "laya") return classifyLayaBatch(context, { items, signal })
  return Promise.all(
    items.map((item) =>
      classifyJevSettled(context, {
        prompt: item.prompt,
        diagnostics: item.diagnostics,
        signal,
        question: "relevant",
      }),
    ),
  )
}

export async function scoreCandidates(
  context: DecisionContext,
  requests: CandidateDecisionRequest[],
): Promise<DecisionResult[]> {
  const items = requests.map((request) => ({
    prompt: candidatePrompt(request),
    diagnostics: initialDiagnostics(context),
  }))
  if (items.length === 0) return []

  const refusal = decisionPreflight(context)
  if (refusal) return items.map((item) => ({ succeeded: false, code: refusal, diagnostics: item.diagnostics }))
  return interruptible(
    context,
    (code) => items.map((item) => ({ succeeded: false, code, diagnostics: item.diagnostics })),
    { run: (signal) => runBatch(context, items, signal) },
  )
}

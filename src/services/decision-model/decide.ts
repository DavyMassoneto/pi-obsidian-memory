import type { DecisionResult } from "#src/domain"
import { initialDiagnostics } from "./diagnostics.ts"
import { interruptibleDecision } from "./interruption.ts"
import { classifyJev } from "./jev.ts"
import { classifyLaya } from "./laya.ts"
import { decisionPreflight } from "./preflight.ts"
import { candidatePrompt, memoryPrompt } from "./prompts.ts"
import type { CandidateDecisionCall, DecisionContext, DecisionPrompt, MemoryDecisionCall } from "./types.ts"

export type { DecisionCutoffs, DecisionProvider } from "#src/domain"
export { defaultCutoffs, rankCandidates, shouldRetrieveMemory } from "#src/domain"

async function decide(context: DecisionContext, prompt: DecisionPrompt): Promise<DecisionResult> {
  const diagnostics = initialDiagnostics(context)
  const refusal = decisionPreflight(context)
  if (refusal) return { succeeded: false, code: refusal, diagnostics }
  return interruptibleDecision(context, diagnostics, {
    async run(signal) {
      const call = {
        prompt,
        diagnostics,
        signal,
        question: questionName(prompt),
      }
      if (context.provider === "laya") return classifyLaya(context, call)
      return classifyJev(context, call)
    },
  })
}

function questionName(prompt: DecisionPrompt): "needed" | "relevant" {
  if ("needed" in prompt.questions) return "needed"
  return "relevant"
}

export function decideMemory(call: MemoryDecisionCall): Promise<DecisionResult> {
  return decide(call.context, memoryPrompt(call.request))
}

export function scoreCandidate(call: CandidateDecisionCall): Promise<DecisionResult> {
  return decide(call.context, candidatePrompt(call.request))
}

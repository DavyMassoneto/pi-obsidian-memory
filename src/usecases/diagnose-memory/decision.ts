import { decideMemory, type MemoryConfig } from "#src/services"
import { describeDecisionFailure } from "#src/usecases/relevant-memory"
import { PROBE_FOLDER, PROBE_MESSAGE } from "./constants.ts"
import type { DecisionProbe, DecisionReport } from "./types.ts"

export async function checkDecision(
  configuration: MemoryConfig["decisionModel"],
  probe: DecisionProbe,
  signal: AbortSignal,
): Promise<DecisionReport> {
  const { provider, model } = configuration
  if (configuration.provider === "laya") {
    const { endpoint, maxTokens, headMaxTokens } = configuration
    const answer = await decideMemory({
      context: {
        provider: "laya",
        endpoint,
        model: configuration.model,
        maxTokens,
        headMaxTokens,
        signal,
      },
      request: { message: PROBE_MESSAGE, project: null, folder: PROBE_FOLDER },
    })
    if (answer.succeeded) return { provider, model, status: "ready", detail: `answered at ${endpoint}` }
    const cause = describeDecisionFailure(answer)
    return { provider, model, status: "not-answering", problem: `${endpoint} is not answering: ${cause}` }
  }
  if (!probe.hasClassifier(provider, model)) {
    return { provider, model, status: "model-missing", problem: `pi has no ${provider} ${model} classifier model` }
  }
  if (!(await probe.hasCredentials(provider))) {
    return { provider, model, status: "no-credentials", problem: `No API key for ${provider}` }
  }
  return { provider, model, status: "ready", detail: "model and API key found" }
}

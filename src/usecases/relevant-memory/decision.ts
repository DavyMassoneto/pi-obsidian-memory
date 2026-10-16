import {
  type CandidateScore,
  type DecisionContext,
  type DecisionFailureCode,
  type DecisionLimits,
  type DecisionResult,
  decideMemory,
  type MemoryConfig,
  type ReadObservation,
  rankCandidates,
  scoreCandidate,
} from "#src/services"
import { DECISION_UNAVAILABLE, ROUTING_MISSING_HELP } from "./constants.ts"
import type { JevSource, RankedNotes } from "./types.ts"

export async function decisionContextOf(
  config: MemoryConfig["decisionModel"],
  limits: DecisionLimits,
  jev: JevSource,
): Promise<DecisionContext | string> {
  if (config.provider === "laya") {
    return {
      provider: "laya",
      endpoint: config.endpoint,
      model: config.model,
      maxTokens: config.maxTokens,
      headMaxTokens: config.headMaxTokens,
      ...limits,
    }
  }
  const access = await jev(config.model)
  if (!access.available) return `${DECISION_UNAVAILABLE} ${access.reason}`
  return {
    provider: "typesafe",
    model: config.model,
    consent: "messages-and-candidates",
    classifier: access.classifier,
    ...limits,
  }
}

export function decisionNotice(result: DecisionResult): string | null {
  if (result.succeeded) return null
  return `${DECISION_UNAVAILABLE} ${describeDecisionFailure(result.code)}`
}

export function describeDecisionFailure(code: DecisionFailureCode): string {
  if (code === "routing-missing") return ROUTING_MISSING_HELP
  return code
}

export function needsMemory(
  context: DecisionContext,
  message: string,
  project: string | null,
  folder: string,
): Promise<DecisionResult> {
  return decideMemory({ context, request: { message, project, folder } })
}

export async function rankNotes(
  context: DecisionContext,
  message: string,
  notes: ReadObservation[],
): Promise<RankedNotes> {
  const scores: CandidateScore[] = []
  for (const note of notes) {
    const result = await scoreCandidate({
      context,
      request: {
        message,
        identity: { vault: note.vault, id: note.id, revision: note.hash },
        candidate: { statement: note.statement, body: note.body },
      },
    })
    const notice = decisionNotice(result)
    if (notice || !result.succeeded) return { notes: [], notice }
    scores.push({
      identity: { vault: note.vault, id: note.id, revision: note.hash },
      probability: result.output.probability,
    })
  }
  const ranked = rankCandidates(scores)
  return { notes: ranked.flatMap((score) => notes.filter((note) => matches(note, score))), notice: null }
}

function matches(note: ReadObservation, score: CandidateScore): boolean {
  const { identity } = score
  return note.vault === identity.vault && note.id === identity.id && note.hash === identity.revision
}

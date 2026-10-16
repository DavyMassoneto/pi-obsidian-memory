import {
  type CandidateScore,
  type DecisionContext,
  type DecisionFailure,
  type DecisionLimits,
  type DecisionResult,
  decideMemory,
  type MemoryConfig,
  type ReadObservation,
  rankCandidates,
  scoreCandidates,
} from "#src/services"
import { COULD_NOT_SCORE, DECISION_UNAVAILABLE, ROUTING_MISSING_HELP } from "./constants.ts"
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
    classifier: access.classifier,
    ...limits,
  }
}

export function decisionNotice(result: DecisionResult): string | null {
  if (result.succeeded) return null
  return `${DECISION_UNAVAILABLE} ${describeDecisionFailure(result)}`
}

export function describeDecisionFailure(failure: DecisionFailure): string {
  if (failure.code === "routing-missing") return ROUTING_MISSING_HELP
  if (failure.code !== "http-error" || typeof failure.httpStatus !== "number") return failure.code
  let text = `${failure.code} (HTTP ${failure.httpStatus})`
  if (typeof failure.detail === "string") text = `${text}: ${failure.detail}`
  return text
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
  cutoff: number,
): Promise<RankedNotes> {
  const results = await scoreCandidates(
    context,
    notes.map((note) => ({
      message,
      identity: identityOf(note),
      candidate: { statement: note.statement, body: note.body },
    })),
  )
  const scores: CandidateScore[] = []
  let failure: DecisionFailure | null = null
  let failed = 0
  results.forEach((result, index) => {
    const note = notes[index]
    if (result.succeeded && note) scores.push({ identity: identityOf(note), probability: result.output.probability })
    else if (!result.succeeded) {
      failed += 1
      failure = result
    }
  })
  if (failure && failed === notes.length) return { notes: [], notice: decisionNotice(failure) }
  const ranked = rankCandidates(scores, cutoff)
  let notice: string | null = null
  if (failed > 0) notice = `${COULD_NOT_SCORE} ${failed} of ${notes.length} notes`
  return { notes: ranked.flatMap((score) => notes.filter((note) => matches(note, score))), notice }
}

function identityOf(note: ReadObservation): CandidateScore["identity"] {
  return { vault: note.vault, id: note.id, revision: note.hash }
}

function matches(note: ReadObservation, score: CandidateScore): boolean {
  const { identity } = score
  return note.vault === identity.vault && note.id === identity.id && note.hash === identity.revision
}

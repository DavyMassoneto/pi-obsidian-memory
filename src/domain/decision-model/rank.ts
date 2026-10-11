import type { CandidateScore } from "./types.ts"

function validateProbability(probability: number): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError("Decision probability must be finite and between 0 and 1")
  }
}

export function shouldRetrieveMemory(probability: number): boolean {
  validateProbability(probability)
  return probability > 0.2
}

function compareScores(left: CandidateScore, right: CandidateScore): number {
  const probabilityOrder = right.probability - left.probability
  if (probabilityOrder !== 0) return probabilityOrder

  for (const field of ["vault", "id", "revision"] as const) {
    if (left.identity[field] < right.identity[field]) return -1
    if (left.identity[field] > right.identity[field]) return 1
  }
  return 0
}

export function rankCandidates(scores: readonly CandidateScore[]): CandidateScore[] {
  for (const score of scores) validateProbability(score.probability)
  return scores.filter((score) => score.probability >= 0.5).sort(compareScores)
}

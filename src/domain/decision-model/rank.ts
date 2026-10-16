import type { CandidateScore } from "./types.ts"

function validateProbability(probability: number): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError("Decision probability must be finite and between 0 and 1")
  }
}

function validateCutoff(cutoff: number): void {
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 1) {
    throw new RangeError("Decision cutoff must be finite and between 0 and 1")
  }
}

export function shouldRetrieveMemory(probability: number, cutoff: number): boolean {
  validateProbability(probability)
  validateCutoff(cutoff)
  return probability > cutoff
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

export function rankCandidates(scores: readonly CandidateScore[], cutoff: number): CandidateScore[] {
  validateCutoff(cutoff)
  for (const score of scores) validateProbability(score.probability)
  return scores.filter((score) => score.probability >= cutoff).sort(compareScores)
}

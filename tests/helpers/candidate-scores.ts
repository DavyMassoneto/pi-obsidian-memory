import type { CandidateScore } from "#src/domain"

export function globalScore(id: string, probability: number): CandidateScore {
  return { identity: { vault: "global", id, revision: "1" }, probability }
}

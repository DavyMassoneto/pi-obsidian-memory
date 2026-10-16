import { standardRrfK } from "./constants.ts"
import type { FusedPath, ScoredPath } from "./types.ts"

export function fuseRankings(text: readonly string[], semantic: readonly string[], limit: number): FusedPath[] {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Fusion limit must be a non-negative integer")

  return [...new Set([...text, ...semantic])]
    .map((path) => ({ path, score: reciprocalRank(text, path) + reciprocalRank(semantic, path) }))
    .sort((left, right) => right.score - left.score || compareText(left.path, right.path))
    .slice(0, limit)
}

function reciprocalRank(ranking: readonly string[], path: string): number {
  const index = ranking.indexOf(path)
  if (index < 0) return 0
  return 1 / (standardRrfK + index + 1)
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function semanticRanking(
  scored: readonly ScoredPath[],
  minimumSimilarity: number | null,
  limit: number,
): string[] {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Ranking limit must be a non-negative integer")

  return scored
    .filter((item) => typeof minimumSimilarity !== "number" || item.similarity >= minimumSimilarity)
    .sort((left, right) => right.similarity - left.similarity || compareText(left.path, right.path))
    .slice(0, limit)
    .map((item) => item.path)
}

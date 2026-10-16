export interface ScoredExample {
  score: number
  positive: boolean
  holdout: boolean
}

export interface CutoffRow {
  cutoff: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number
  recall: number
}

export interface AucInterval {
  low: number
  high: number
}

export const CUTOFFS = Array.from({ length: 19 }, (_, index) => Math.round((index + 1) * 5) / 100)

export interface HoldoutMarked {
  holdout: boolean
}

export interface LabelledExample {
  positive: boolean
}

export function withHoldout<T extends LabelledExample>(items: T[]): (T & HoldoutMarked)[] {
  const seen = { positive: 0, negative: 0 }
  return items.map((item) => {
    if (item.positive) return { ...item, holdout: seen.positive++ % 2 === 1 }
    return { ...item, holdout: seen.negative++ % 2 === 1 }
  })
}

export function auc(scored: ScoredExample[]): number {
  const positives = scored.filter((example) => example.positive)
  const negatives = scored.filter((example) => !example.positive)
  let wins = 0
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.score > negative.score) wins += 1
      else if (positive.score === negative.score) wins += 0.5
    }
  }
  return wins / (positives.length * negatives.length)
}

export function aucInterval(value: number, positives: number, negatives: number): AucInterval {
  const q1 = value / (2 - value)
  const q2 = (2 * value * value) / (1 + value)
  const variance =
    (value * (1 - value) + (positives - 1) * (q1 - value * value) + (negatives - 1) * (q2 - value * value)) /
    (positives * negatives)
  const margin = 1.96 * Math.sqrt(variance)
  return { low: Math.max(0, value - margin), high: Math.min(1, value + margin) }
}

export function cutoffRow(scored: ScoredExample[], cutoff: number): CutoffRow {
  const truePositives = scored.filter((example) => example.positive && example.score >= cutoff).length
  const falsePositives = scored.filter((example) => !example.positive && example.score >= cutoff).length
  const falseNegatives = scored.filter((example) => example.positive && example.score < cutoff).length
  const precision = truePositives / (truePositives + falsePositives)
  const recall = truePositives / (truePositives + falseNegatives)
  return { cutoff, truePositives, falsePositives, falseNegatives, precision, recall }
}

function f1(row: CutoffRow): number {
  const denominator = 2 * row.truePositives + row.falsePositives + row.falseNegatives
  if (denominator === 0) return 0
  return (2 * row.truePositives) / denominator
}

export function bestCutoff(fit: ScoredExample[]): number {
  let best = 0.5
  let bestScore = -1
  for (const cutoff of CUTOFFS) {
    const score = f1(cutoffRow(fit, cutoff))
    if (score > bestScore) {
      best = cutoff
      bestScore = score
    }
  }
  return best
}

export function meanScore(scored: ScoredExample[], positive: boolean): number {
  const selected = scored.filter((example) => example.positive === positive)
  return selected.reduce((sum, example) => sum + example.score, 0) / selected.length
}

function percent(value: number): string {
  if (Number.isNaN(value)) return "-"
  return `${Math.round(value * 100)}%`
}

export function cutoffTable(holdout: ScoredExample[]): string {
  const rows = CUTOFFS.filter((cutoff) => cutoff >= 0.1 && cutoff <= 0.9 && Math.round(cutoff * 100) % 10 === 0)
  const lines = ["| cutoff | precision | recall | TP | FP | FN |", "| ---: | ---: | ---: | ---: | ---: | ---: |"]
  for (const cutoff of rows) {
    const row = cutoffRow(holdout, cutoff)
    lines.push(
      `| ${cutoff.toFixed(1)} | ${percent(row.precision)} | ${percent(row.recall)} | ${row.truePositives} | ${row.falsePositives} | ${row.falseNegatives} |`,
    )
  }
  return lines.join("\n")
}

export function variantSummary(name: string, scored: ScoredExample[]): string {
  const fit = scored.filter((example) => !example.holdout)
  const holdout = scored.filter((example) => example.holdout)
  const holdoutAuc = auc(holdout)
  const interval = aucInterval(
    holdoutAuc,
    holdout.filter((example) => example.positive).length,
    holdout.filter((example) => !example.positive).length,
  )
  const allAuc = auc(scored)
  const allInterval = aucInterval(
    allAuc,
    scored.filter((example) => example.positive).length,
    scored.filter((example) => !example.positive).length,
  )
  const chosen = bestCutoff(fit)
  const atChosen = cutoffRow(holdout, chosen)
  return [
    `#### ${name}`,
    "",
    `- all-items AUC ${allAuc.toFixed(3)} (95% interval ${allInterval.low.toFixed(2)}-${allInterval.high.toFixed(2)}, n=${scored.length})`,
    `- fit AUC ${auc(fit).toFixed(3)}; holdout AUC ${holdoutAuc.toFixed(3)} (95% interval ${interval.low.toFixed(2)}-${interval.high.toFixed(2)})`,
    `- mean score on holdout: positives ${meanScore(holdout, true).toFixed(3)}, negatives ${meanScore(holdout, false).toFixed(3)}`,
    `- best F1 cutoff on fit: ${chosen.toFixed(2)}; on holdout it gives precision ${percent(atChosen.precision)}, recall ${percent(atChosen.recall)}`,
    "",
    cutoffTable(holdout),
  ].join("\n")
}

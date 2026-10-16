import { type DecisionCutoffs, defaultCutoffs, type MemoryConfig } from "#src/services"
import { CUTOFFS_HELP, CUTOFFS_MISSING } from "./constants.ts"
import type { CutoffReport, CutoffValue } from "./types.ts"

function cutoffOf(configured: number | undefined, fallback: number | undefined): CutoffValue {
  if (typeof configured === "number") return { value: configured, source: "config" }
  if (typeof fallback === "number") return { value: fallback, source: "typesafe" }
  return { value: null, source: "missing" }
}

export function resolveCutoffs(config: MemoryConfig["decisionModel"]): CutoffReport {
  const defaults = defaultCutoffs(config.provider)
  return {
    gate: cutoffOf(config.gateThreshold, defaults.gate),
    relevance: cutoffOf(config.relevanceThreshold, defaults.relevance),
  }
}

export function decidingCutoffs(report: CutoffReport): DecisionCutoffs | null {
  if (typeof report.gate.value !== "number" || typeof report.relevance.value !== "number") return null
  return { gate: report.gate.value, relevance: report.relevance.value }
}

export function cutoffsMissingNotice(report: CutoffReport): string {
  const names: string[] = []
  if (report.gate.source === "missing") names.push("gateThreshold")
  if (report.relevance.source === "missing") names.push("relevanceThreshold")
  return `${CUTOFFS_MISSING} ${names.join(" and ")}; ${CUTOFFS_HELP}`
}

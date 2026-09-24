import { CHECKS } from "./constants.ts"
import type { Check, PreflightContext, Problem } from "./types.ts"

export function runPreflight(context: PreflightContext, checks: readonly Check[] = CHECKS): Problem[] {
  return checks.map((check) => check(context)).filter((problem) => problem !== undefined)
}

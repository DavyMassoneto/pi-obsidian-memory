import { CHECKS } from "./preflight.constants.ts"
import type { Check, PreflightContext, Problem } from "./preflight.types.ts"

export function runPreflight(context: PreflightContext, checks: readonly Check[] = CHECKS): Problem[] {
  return checks.map((check) => check(context)).filter((problem) => problem !== undefined)
}

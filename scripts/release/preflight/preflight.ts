import type { Check, PreflightContext, Problem } from "./types.ts"

export function runPreflight(context: PreflightContext, checks: readonly Check[]): Problem[] {
  return checks.flatMap((check) => check(context))
}

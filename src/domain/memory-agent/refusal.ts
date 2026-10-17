import { MAX_REFUSAL_PROBLEMS } from "./constants.ts"
import type { RefusedStep } from "./types.ts"

export function refusalObservation(problems: string[]): RefusedStep {
  const texts = problems.filter((problem) => problem.trim() !== "").slice(0, MAX_REFUSAL_PROBLEMS)
  return { kind: "refused", action: "unparseable", problems: texts }
}

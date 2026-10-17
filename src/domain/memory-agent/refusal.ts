import type { RefusedStep } from "./types.ts"

export function refusalObservation(problems: string[]): RefusedStep {
  const texts = problems.filter((problem) => problem.trim() !== "")
  return { kind: "refused", action: "unparseable", problems: texts }
}

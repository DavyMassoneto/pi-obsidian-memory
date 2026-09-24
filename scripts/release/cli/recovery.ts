import type { Step } from "../index.ts"

export function formatFailure(failed: Step, done: readonly Step[], error: Error): string {
  const lines = [`✖ Failed at: ${failed.title}`, `  ${error.message}`]
  if (done.length > 0) lines.push("", "Already done:", ...done.map((step) => `  ✔ ${step.title}`))
  lines.push("", "How to continue:", `  ${failed.recovery}`)
  return lines.join("\n")
}

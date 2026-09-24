import type { Step } from "../index.ts"

export function formatFailure(failed: Step, done: readonly Step[], error: Error): string {
  const lines = [`✖ Falhou em: ${failed.title}`, `  ${error.message}`]
  if (done.length > 0) lines.push("", "Já feito:", ...done.map((step) => `  ✔ ${step.title}`))
  lines.push("", "Como seguir:", `  ${failed.recovery}`)
  return lines.join("\n")
}

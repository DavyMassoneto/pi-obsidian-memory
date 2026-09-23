import type { Step } from "./plan.ts";

/** Relatório para quando um passo falha: o que já foi feito, o erro e como seguir. */
export function formatFailure(failed: Step, done: readonly Step[], error: unknown): string {
  const lines = [`✖ Falhou em: ${failed.title}`, `  ${error instanceof Error ? error.message : String(error)}`];
  if (done.length > 0) lines.push("", "Já feito:", ...done.map((step) => `  ✔ ${step.title}`));
  lines.push("", "Como seguir:", `  ${failed.recovery}`);
  return lines.join("\n");
}

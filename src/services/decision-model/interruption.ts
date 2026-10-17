import type { DecisionDiagnostics, DecisionResult } from "#src/domain"
import type { DecisionContext, DecisionInterruption, DecisionOperation, InterruptibleOperation } from "./types.ts"

export function interruptibleDecision(
  context: DecisionContext,
  diagnostics: DecisionDiagnostics,
  operation: DecisionOperation,
): Promise<DecisionResult> {
  return interruptible(context, (code) => ({ succeeded: false, code, diagnostics }), operation)
}

export async function interruptible<Outcome>(
  context: DecisionContext,
  interrupted: DecisionInterruption<Outcome>,
  operation: InterruptibleOperation<Outcome>,
): Promise<Outcome> {
  const { signal } = context
  if (signal.aborted) return interrupted("aborted")
  const interruption = Promise.withResolvers<Outcome>()
  const onAbort = () => interruption.resolve(interrupted("aborted"))
  signal.addEventListener("abort", onAbort, { once: true })
  try {
    return await Promise.race([operation.run(signal), interruption.promise])
  } catch {
    return interrupted("unavailable")
  } finally {
    signal.removeEventListener("abort", onAbort)
  }
}

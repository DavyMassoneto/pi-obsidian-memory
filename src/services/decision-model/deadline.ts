import type { DecisionDiagnostics, DecisionResult } from "#src/domain"
import { remainingDecisionMs } from "./preflight.ts"
import type { DeadlineOperation, DecisionContext, DecisionInterruption, DecisionOperation } from "./types.ts"

export function withinDecisionDeadline(
  context: DecisionContext,
  diagnostics: DecisionDiagnostics,
  operation: DecisionOperation,
): Promise<DecisionResult> {
  return withinDeadline(context, (code) => ({ succeeded: false, code, diagnostics }), operation)
}

export async function withinDeadline<Outcome>(
  context: DecisionContext,
  interrupted: DecisionInterruption<Outcome>,
  operation: DeadlineOperation<Outcome>,
): Promise<Outcome> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  context.signal.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, remainingDecisionMs(context))
  const interruption = new Promise<Outcome>((resolve) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        if (context.signal.aborted) resolve(interrupted("aborted"))
        else resolve(interrupted("deadline"))
      },
      { once: true },
    )
  })
  try {
    if (context.signal.aborted) abort()
    if (controller.signal.aborted) return await interruption
    return await Promise.race([operation.run(controller.signal), interruption])
  } catch {
    return interrupted("unavailable")
  } finally {
    clearTimeout(timer)
    context.signal.removeEventListener("abort", abort)
  }
}

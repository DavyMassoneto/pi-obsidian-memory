import type { DecisionDiagnostics, DecisionResult } from "#/domain"
import { remainingDecisionMs } from "./preflight.ts"
import type { DecisionContext, DecisionOperation } from "./types.ts"

export async function withinDecisionDeadline(
  context: DecisionContext,
  diagnostics: DecisionDiagnostics,
  operation: DecisionOperation,
): Promise<DecisionResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  context.signal.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, remainingDecisionMs(context))
  const interruption = new Promise<DecisionResult>((resolve) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        if (context.signal.aborted) resolve({ succeeded: false, code: "aborted", diagnostics })
        else resolve({ succeeded: false, code: "deadline", diagnostics })
      },
      { once: true },
    )
  })
  try {
    if (context.signal.aborted) abort()
    if (controller.signal.aborted) return await interruption
    return await Promise.race([operation.run(controller.signal), interruption])
  } catch {
    return { succeeded: false, code: "unavailable", diagnostics }
  } finally {
    clearTimeout(timer)
    context.signal.removeEventListener("abort", abort)
  }
}

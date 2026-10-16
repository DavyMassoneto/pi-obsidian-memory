import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { LimitedOperation } from "./types.ts"

export function limitOperation(context: MemoryOperationContext, limitMs: number): LimitedOperation {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), limitMs)
  return {
    context: { ...context, signal: AbortSignal.any([context.signal, controller.signal]) },
    expired: () => controller.signal.aborted,
    release: () => clearTimeout(timer),
  }
}

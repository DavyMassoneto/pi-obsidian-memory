import type { MemoryOperationContext, MemoryOperationRefusal } from "./types.ts"

export function captureMemoryOperationContext(context: MemoryOperationContext): MemoryOperationContext {
  const captured: MemoryOperationContext = {
    configPath: context.configPath,
    workingFolder: context.workingFolder,
    indexPath: context.indexPath,
    session: context.session,
    stamp: context.stamp,
    signal: context.signal,
  }
  if (context.semantic) captured.semantic = context.semantic
  return captured
}

export function memoryOperationInterruption(context: MemoryOperationContext): MemoryOperationRefusal | null {
  if (!context.session.isCurrent(context.stamp)) return staleMemorySession()
  if (context.signal.aborted) {
    return { succeeded: false, reason: "cancelled", problems: ["Memory read cancelled; retry with a live signal"] }
  }
  return null
}

export function staleMemorySession(): MemoryOperationRefusal {
  return {
    succeeded: false,
    reason: "stale-session",
    problems: ["Memory session or configuration changed; retry with a fresh session stamp"],
  }
}

export function memoryAdmissionRefusal(context: MemoryOperationContext): MemoryOperationRefusal {
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  return { succeeded: false, reason: "admission-refused", problems: ["Memory session is not accepting operations"] }
}

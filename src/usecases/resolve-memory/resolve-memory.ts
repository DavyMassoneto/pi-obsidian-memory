import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import type { ResolveMemoryResult } from "./types.ts"

export async function resolveMemory(callerContext: MemoryOperationContext): Promise<ResolveMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const result = await resolveLeasedMemory(context)
    if (!result.succeeded) return result
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    return result
  } finally {
    lease.release()
  }
}

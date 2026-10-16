import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#/usecases/operation-context"
import { synchronizeLeasedMemory } from "#/usecases/synchronize-memory/leased"
import type { SynchronizeMemoryRequest, SynchronizeMemoryResult } from "./types.ts"

export async function synchronizeMemory(
  input: SynchronizeMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<SynchronizeMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const request = { vault: input.vault }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return { ...memoryAdmissionRefusal(context), progress: null }
  try {
    const result = await synchronizeLeasedMemory(request, context)
    const interrupted = memoryOperationInterruption(context)
    if (interrupted && result.succeeded) return { ...interrupted, progress: result.output }
    return result
  } finally {
    lease.release()
  }
}

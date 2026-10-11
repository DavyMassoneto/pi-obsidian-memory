import { readLeasedFolder } from "#/usecases/list-memory/leased"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#/usecases/operation-context"
import { resolveLeasedMemory, selectMemoryVault } from "#/usecases/resolve-memory/leased"
import type { ListMemoryRequest, ListMemoryResult } from "./types.ts"

export async function listMemory(
  input: ListMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<ListMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const request = { vault: input.vault, folder: input.folder }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    const interrupted = memoryOperationInterruption(context)
    if (!memory.succeeded) return memory
    if (interrupted) return interrupted
    const target = selectMemoryVault(memory.output, request.vault)
    if (!target.succeeded) return target
    const result = await readLeasedFolder(target.output, request.folder, context)
    const stale = memoryOperationInterruption(context)
    if (stale) return stale
    return result
  } finally {
    lease.release()
  }
}

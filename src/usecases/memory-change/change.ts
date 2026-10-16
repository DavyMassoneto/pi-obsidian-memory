import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { resolveLeasedMemory, selectMemoryVault } from "#src/usecases/resolve-memory/leased"
import type { MemoryAddress } from "#src/usecases/session"
import { receiptedNote } from "./receipt.ts"
import type { ApplyChange, ChangeOutcome, ChangeRefusal } from "./types.ts"

export async function changeLeasedMemory<Result extends ChangeOutcome>(
  address: MemoryAddress,
  callerContext: MemoryOperationContext,
  apply: ApplyChange<Result>,
): Promise<Result | ChangeRefusal> {
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    const stale = memoryOperationInterruption(context)
    if (stale) return stale
    const target = selectMemoryVault(memory.output, address.vault)
    if (!target.succeeded) return target
    const receipted = receiptedNote(context, address, target.output.vault.path)
    if (!receipted.succeeded) return receipted
    const result = await apply({ target: target.output, context, receipted: receipted.output })
    if (consumesReceipt(result)) context.session.consumeReceipt(context.stamp, address)
    return result
  } finally {
    lease.release()
  }
}

function consumesReceipt(result: ChangeOutcome): boolean {
  if (result.succeeded) return true
  return result.reason === "conflict" || result.reason === "partial"
}

import { completeBlankFile, type Note, newNoteId, refreshIndexes, today } from "#src/services"
import { refreshWarnings, warningsOf } from "#src/usecases/memory-change"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
} from "#src/usecases/operation-context"
import { resolveLeasedMemory, selectMemoryVault } from "#src/usecases/resolve-memory/leased"
import type { CompleteBlankMemoryRequest, CompleteBlankMemoryResult } from "./types.ts"

export async function completeBlankMemory(
  request: CompleteBlankMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<CompleteBlankMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    const target = selectMemoryVault(memory.output, request.vault)
    if (!target.succeeded) return target
    const day = today()
    const note: Note = {
      statement: statementOf(request.path),
      frontmatter: { id: newNoteId(), type: request.type, created: day, updated: day },
      body: request.body,
    }
    const completed = await completeBlankFile(target.output.vault, {
      path: request.path,
      expectedHash: request.expectedHash,
      note,
      confirmed: true,
    })
    if (!completed.succeeded) return completed
    const folder = request.path.slice(0, Math.max(0, request.path.lastIndexOf("/")))
    const refreshed = await refreshIndexes(target.output.vault, folder)
    const maintenanceProblems = [...warningsOf(completed), ...refreshWarnings(refreshed)]
    return { succeeded: true, output: { vault: request.vault, path: request.path, maintenanceProblems } }
  } finally {
    lease.release()
  }
}

function statementOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1)
  return name.slice(0, -".md".length)
}

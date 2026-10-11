import { inspectVaultFile, observeVaultPath } from "#/services"
import { readLeasedFolder } from "#/usecases/list-memory/leased"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
  staleMemorySession,
} from "#/usecases/operation-context"
import type { ResolvedVault } from "#/usecases/resolve-memory"
import { resolveLeasedMemory, selectMemoryVault } from "#/usecases/resolve-memory/leased"
import type { GetMemoryRequest, GetMemoryResult } from "./types.ts"

export async function getMemory(
  input: GetMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<GetMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const request = { vault: input.vault, path: input.path, sourceCallId: input.sourceCallId }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    context.session.consumeReceipt(context.stamp, request)
    const memory = await resolveLeasedMemory(context)
    const stale = memoryOperationInterruption(context)
    if (!memory.succeeded) return memory
    if (stale) return stale
    const target = selectMemoryVault(memory.output, request.vault)
    if (!target.succeeded) return target
    const result = await getLeasedMemory(request, target.output, context)
    return deliverMemory(result, request, target.output, context)
  } finally {
    lease.release()
  }
}

async function getLeasedMemory(
  request: GetMemoryRequest,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<GetMemoryResult> {
  const entry = await observeVaultPath(target.vault, { path: request.path })
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!entry.succeeded) return entry
  if (entry.output.kind === "directory") return readLeasedFolder(target, request.path, context)
  return getLeasedNote(request, target, context)
}

async function getLeasedNote(
  request: GetMemoryRequest,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<GetMemoryResult> {
  const inspected = await inspectVaultFile(target.vault, { path: request.path })
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!inspected.succeeded) return inspected
  const file = inspected.output
  const analysis = file.analysis
  if (analysis.status === "unclosed") {
    return {
      succeeded: false,
      reason: "unclosed-frontmatter",
      file,
      problems: [...analysis.frontmatterProblems, ...analysis.nameProblems, ...analysis.bodyProblems],
    }
  }
  return { succeeded: true, output: { kind: "note", vault: request.vault, file: { ...file, analysis } } }
}

function deliverMemory(
  result: GetMemoryResult,
  request: GetMemoryRequest,
  target: ResolvedVault,
  context: MemoryOperationContext,
): GetMemoryResult {
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!result.succeeded || result.output.kind !== "note") return result
  const file = result.output.file
  const analysis = file.analysis
  let id: string | null = null
  if (analysis.frontmatter) id = analysis.frontmatter.id
  const remembered = context.session.rememberGet(context.stamp, {
    ...file,
    analysis,
    id,
    vault: request.vault,
    canonicalVault: target.vault.path,
    sourceCallId: request.sourceCallId,
  })
  if (!remembered) return staleMemorySession()
  return result
}

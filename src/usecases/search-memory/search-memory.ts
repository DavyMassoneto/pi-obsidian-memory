import { closeIndex, type MemoryScope, type OpenedIndex, searchCatalog } from "#src/services"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import {
  type ResolvedMemory,
  type ResolvedVault,
  resolveLeasedMemory,
  selectMemoryVault,
} from "#src/usecases/resolve-memory/leased"
import { openVaultIndex, synchronizeOpenedMemory } from "#src/usecases/synchronize-memory/leased"
import { SEARCH_RESULT_LIMIT } from "./constants.ts"
import type {
  SearchedMemory,
  SearchMemoryRequest,
  SearchMemoryResult,
  VaultSearchFailure,
  VaultSearchHits,
} from "./types.ts"

export async function searchMemory(
  input: SearchMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<SearchMemoryResult> {
  const context = captureMemoryOperationContext(callerContext)
  const request = { query: input.query, vault: input.vault }
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    return await searchResolvedMemory(request, memory.output, context)
  } finally {
    lease.release()
  }
}

async function searchResolvedMemory(
  request: SearchMemoryRequest,
  memory: ResolvedMemory,
  context: MemoryOperationContext,
): Promise<SearchMemoryResult> {
  const output: SearchedMemory = { vaults: [], projectMissing: false }
  for (const scope of scopesOf(request.vault)) {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    const target = selectMemoryVault(memory, scope)
    if (!target.succeeded) {
      output.projectMissing = true
      continue
    }
    output.vaults.push(await searchLeasedVault(request.query, memory, target.output, context))
  }
  const stale = memoryOperationInterruption(context)
  if (stale) return stale
  return { succeeded: true, output }
}

function scopesOf(vault: SearchMemoryRequest["vault"]): MemoryScope[] {
  if (vault === "both") return ["global", "project"]
  return [vault]
}

async function searchLeasedVault(
  query: string,
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<VaultSearchHits | VaultSearchFailure> {
  const opened = openVaultIndex(memory, target)
  if (!opened.succeeded) return { vault: target.scope, problems: opened.problems }
  const warnings: string[] = []
  let result: VaultSearchHits | VaultSearchFailure
  try {
    result = await searchSynchronizedVault(query, opened, memory, target, context)
  } finally {
    const closed = closeIndex(opened.output)
    if (!closed.succeeded) warnings.push(...closed.problems)
  }
  if ("hits" in result) result.warnings.push(...warnings)
  else result.problems.push(...warnings)
  return result
}

async function searchSynchronizedVault(
  query: string,
  opened: OpenedIndex,
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<VaultSearchHits | VaultSearchFailure> {
  const synchronized = await synchronizeOpenedMemory(opened, memory, target, context)
  if (!synchronized.succeeded) return { vault: target.scope, problems: synchronized.problems }
  const found = searchCatalog(opened.output, { query, limit: SEARCH_RESULT_LIMIT })
  if (!found.succeeded) return { vault: target.scope, problems: found.problems }
  return { vault: target.scope, hits: found.output, warnings: synchronized.output.warnings }
}

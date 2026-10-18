import {
  closeIndex,
  embeddingFingerprint,
  type MemoryScope,
  type OpenedIndex,
  readVectorCoverage,
  searchCatalog,
} from "#src/services"
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
import { fuseSearchHits, prepareSemanticSearch, rankSemantically, semanticPortOf } from "#src/usecases/semantic"
import { openVaultIndex, synchronizeOpenedMemory } from "#src/usecases/synchronize-memory/leased"
import { SEMANTIC_PARTIAL_LINE } from "./constants.ts"
import type {
  SearchedMemory,
  SearchMemoryRequest,
  SearchMemoryResult,
  VaultSearchFailure,
  VaultSearchHits,
  VaultSemantic,
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
  const port = await semanticPortOf(context, memory)
  const prepared = await prepareSemanticSearch(port, request.query, context)
  const semantic: VaultSemantic = { port, query: prepared.query }
  const problems = [...prepared.problems]
  const output: SearchedMemory = { vaults: [], projectMissing: false, semantic: { mode: "text-only", problems } }
  if (prepared.query) output.semantic.mode = "fused"
  for (const scope of scopesOf(request.vault)) {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    const target = selectMemoryVault(memory, scope)
    if (!target.succeeded) {
      output.projectMissing = true
      continue
    }
    output.vaults.push(await searchLeasedVault(request.query, memory, target.output, context, semantic, problems))
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
  semantic: VaultSemantic,
  problems: string[],
): Promise<VaultSearchHits | VaultSearchFailure> {
  const opened = openVaultIndex(memory, target)
  if (!opened.succeeded) return { vault: target.scope, problems: opened.problems }
  const warnings: string[] = []
  let result: VaultSearchHits | VaultSearchFailure
  try {
    result = await searchSynchronizedVault(query, opened, memory, target, context, semantic, problems)
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
  semantic: VaultSemantic,
  problems: string[],
): Promise<VaultSearchHits | VaultSearchFailure> {
  const synchronized = await synchronizeOpenedMemory(opened, memory, target, context, semantic.port)
  if (!synchronized.succeeded) return { vault: target.scope, problems: synchronized.problems }
  const found = searchCatalog(opened.output, { query })
  if (!found.succeeded) return { vault: target.scope, problems: found.problems }
  const warnings = [...synchronized.output.warnings]
  if (!semantic.query) return { vault: target.scope, hits: found.output, warnings }
  const ranked = rankSemantically(opened.output, semantic.query, memory.config.embeddings.provider)
  warnings.push(...ranked.problems)
  const missing = missingVectors(opened, memory)
  if (missing > 0) problems.push(`${target.scope}: ${missing} ${SEMANTIC_PARTIAL_LINE}`)
  return { vault: target.scope, hits: fuseSearchHits(found.output, ranked), warnings }
}

function missingVectors(opened: OpenedIndex, memory: ResolvedMemory): number {
  const coverage = readVectorCoverage(opened.output)
  if (!coverage.succeeded) return 0
  const { generation, embedded, current } = coverage.output
  if (generation?.fingerprint !== embeddingFingerprint(memory.config.embeddings)) return current
  return Math.max(0, current - embedded)
}

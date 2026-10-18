import {
  catalogValidationFingerprint,
  closeIndex,
  indexFileFor,
  type OpenedIndex,
  type OpenIndexResult,
  readIndexInventory,
  recoverIndex,
} from "#src/services"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import {
  type ResolvedMemory,
  type ResolvedVault,
  resolveLeasedMemory,
  selectMemoryVault,
} from "#src/usecases/resolve-memory/leased"
import { refreshSemantic, semanticPortOf } from "#src/usecases/semantic"
import type { SemanticPort } from "#src/usecases/semantic-port"
import { maintainMemoryFolders } from "./maintenance.ts"
import { publishMemoryCatalog } from "./publication.ts"
import { scanMemoryCatalog } from "./scan.ts"
import type {
  CatalogSynchronization,
  SynchronizationProgress,
  SynchronizeMemoryRequest,
  SynchronizeMemoryResult,
} from "./types.ts"

export async function synchronizeLeasedMemory(
  request: SynchronizeMemoryRequest,
  context: MemoryOperationContext,
): Promise<SynchronizeMemoryResult> {
  const resolved = await resolveLeasedMemory(context)
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return { ...interrupted, progress: null }
  if (!resolved.succeeded) return { ...resolved, progress: null }
  const target = selectMemoryVault(resolved.output, request.vault)
  if (!target.succeeded) return { ...target, progress: null }
  return synchronizeSelectedMemory(resolved.output, target.output, context)
}

async function synchronizeSelectedMemory(
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<SynchronizeMemoryResult> {
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return { ...interrupted, progress: null }
  const opened = openVaultIndex(memory, target)
  if (!opened.succeeded) return { ...opened, progress: null }
  const warnings: string[] = []
  const semantic = await semanticPortOf(context, memory)
  let result: SynchronizeMemoryResult
  try {
    result = await synchronizeOpenedMemory(opened, memory, target, context, semantic)
  } finally {
    const closed = closeIndex(opened.output)
    if (!closed.succeeded) warnings.push(...closed.problems)
  }
  if (result.succeeded) result.output.warnings.push(...warnings)
  else result.problems.push(...warnings)
  return result
}

export function openVaultIndex(memory: ResolvedMemory, target: ResolvedVault): OpenIndexResult {
  return recoverIndex({ path: indexFileFor(memory.indexPath, target.vault.path, memory.platform) })
}

export async function synchronizeOpenedMemory(
  opened: OpenedIndex,
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
  semantic: SemanticPort | null,
): Promise<SynchronizeMemoryResult> {
  const inventory = readIndexInventory(opened.output)
  if (!inventory.succeeded) return { ...inventory, progress: null }
  const progress: SynchronizationProgress = {
    vault: target.scope,
    revision: inventory.output.revision,
    population: inventory.output.population,
    rebuilt: opened.rebuilt,
    committed: false,
    coverage: "degraded",
    duplicateIds: [],
    warnings: [],
  }
  const work: CatalogSynchronization = { context, target, index: opened.output, progress }
  const validationFingerprint = catalogValidationFingerprint(memory.config.limits)
  const scanned = await scanMemoryCatalog(work, inventory.output, validationFingerprint)
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return { ...interrupted, progress }
  if (!scanned.succeeded) return { ...scanned, progress }
  progress.warnings.push(...scanned.output.warnings)
  const published = publishMemoryCatalog(work, inventory.output, scanned.output.catalog)
  if (!published.succeeded) return { ...published, progress }
  await maintainMemoryFolders(work, scanned.output)
  progress.warnings.push(...(await refreshSemantic(opened.output, memory, semantic, context)))
  const stale = memoryOperationInterruption(context)
  if (stale) return { ...stale, progress }
  return { succeeded: true, output: progress }
}

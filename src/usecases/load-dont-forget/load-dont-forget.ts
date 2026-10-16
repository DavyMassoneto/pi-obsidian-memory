import {
  closeIndex,
  dontForgetCandidates,
  inspectVaultFile,
  isLoadedDontForget,
  type OpenedIndex,
  readIndexInventory,
  type VaultNoteAnalysis,
} from "#src/services"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { type ResolvedMemory, type ResolvedVault, resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import { openVaultIndex, synchronizeOpenedMemory } from "#src/usecases/synchronize-memory/leased"
import type { DontForgetVault, LoadDontForgetResult, LoadedDontForgetNote } from "./types.ts"

export async function loadDontForget(callerContext: MemoryOperationContext): Promise<LoadDontForgetResult> {
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    return await loadResolvedVaults(memory.output, context)
  } finally {
    lease.release()
  }
}

async function loadResolvedVaults(
  memory: ResolvedMemory,
  context: MemoryOperationContext,
): Promise<LoadDontForgetResult> {
  const targets = [memory.global]
  if (memory.project) targets.push(memory.project)
  const vaults: DontForgetVault[] = []
  for (const target of targets) {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    vaults.push(await loadLeasedVault(memory, target, context))
  }
  const stale = memoryOperationInterruption(context)
  if (stale) return stale
  return { succeeded: true, output: { vaults } }
}

async function loadLeasedVault(
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<DontForgetVault> {
  const opened = openVaultIndex(memory, target)
  if (!opened.succeeded) return { vault: target.scope, notes: [], problems: opened.problems }
  const result: DontForgetVault = { vault: target.scope, notes: [], problems: [] }
  try {
    await loadSynchronizedVault(result, opened, memory, target, context)
  } finally {
    const closed = closeIndex(opened.output)
    if (!closed.succeeded) result.problems.push(...closed.problems)
  }
  return result
}

async function loadSynchronizedVault(
  result: DontForgetVault,
  opened: OpenedIndex,
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<void> {
  const synchronized = await synchronizeOpenedMemory(opened, memory, target, context, null)
  if (!synchronized.succeeded) {
    result.problems.push(...synchronized.problems)
    return
  }
  const inventory = readIndexInventory(opened.output)
  if (!inventory.succeeded) {
    result.problems.push(...inventory.problems)
    return
  }
  for (const path of dontForgetCandidates(inventory.output).sort()) {
    if (memoryOperationInterruption(context)) return
    const inspected = await inspectVaultFile(target.vault, { path })
    if (!inspected.succeeded) {
      result.problems.push(...inspected.problems)
      continue
    }
    const note = loadedNote(target, path, inspected.output.analysis)
    if (note) result.notes.push(note)
  }
}

function loadedNote(target: ResolvedVault, path: string, analysis: VaultNoteAnalysis): LoadedDontForgetNote | null {
  if (!isLoadedDontForget(analysis) || analysis.status !== "parsed" || !analysis.frontmatter) return null
  return {
    vault: target.scope,
    path,
    type: analysis.frontmatter.type,
    body: analysis.parsed.body,
    problems: [...analysis.frontmatterProblems, ...analysis.nameProblems, ...analysis.bodyProblems],
  }
}

import {
  type CatalogEntry,
  closeIndex,
  type MapNote,
  type MapVault,
  type OpenedIndex,
  readIndexInventory,
} from "#src/services"
import {
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { type ResolvedMemory, type ResolvedVault, resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import { openVaultIndex, synchronizeOpenedMemory } from "#src/usecases/synchronize-memory/leased"
import type { LoadMemoryMapResult } from "./types.ts"

export async function loadMemoryMap(context: MemoryOperationContext): Promise<LoadMemoryMapResult> {
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    return await mapResolvedVaults(memory.output, context)
  } finally {
    lease.release()
  }
}

async function mapResolvedVaults(
  memory: ResolvedMemory,
  context: MemoryOperationContext,
): Promise<LoadMemoryMapResult> {
  const targets: ResolvedVault[] = []
  if (memory.project) targets.push(memory.project)
  targets.push(memory.global)
  const vaults: MapVault[] = []
  for (const target of targets) {
    const interrupted = memoryOperationInterruption(context)
    if (interrupted) return interrupted
    vaults.push(await mapLeasedVault(memory, target, context))
  }
  const stale = memoryOperationInterruption(context)
  if (stale) return stale
  return { succeeded: true, output: vaults }
}

async function mapLeasedVault(
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<MapVault> {
  const result: MapVault = { vault: target.scope, name: target.vault.name, notes: [], problems: [] }
  const opened = openVaultIndex(memory, target)
  if (!opened.succeeded) {
    result.problems.push(...opened.problems)
    return result
  }
  try {
    await mapSynchronizedVault(result, opened, memory, target, context)
  } finally {
    const closed = closeIndex(opened.output)
    if (!closed.succeeded) result.problems.push(...closed.problems)
  }
  return result
}

async function mapSynchronizedVault(
  result: MapVault,
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
  result.notes.push(...inventory.output.entries.flatMap(mapNoteOf))
}

function mapNoteOf(entry: CatalogEntry): MapNote[] {
  if (!entry.note || entry.note.archived) return []
  return [{ path: entry.path, type: entry.note.type, dontForget: entry.note.dontForget }]
}

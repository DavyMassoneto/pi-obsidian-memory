import { enumerateVault, inspectVaultFile, renderMemoryMap } from "#src/services"
import {
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { type ResolvedMemory, type ResolvedVault, resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import type { MemoryMapCollection, MemoryMapResult } from "./types.ts"

export async function loadMemoryMap(context: MemoryOperationContext): Promise<MemoryMapResult> {
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    const memory = await resolveLeasedMemory(context)
    if (!memory.succeeded) return memory
    const collected: MemoryMapCollection = { notes: [], problems: [] }
    await collectMemoryMap(memory.output, context, collected)
    const stale = memoryOperationInterruption(context)
    if (stale) return stale
    return {
      succeeded: true,
      output: { ...collected, text: renderMemoryMap(collected.notes, memory.output.config.context.budgetChars) },
    }
  } finally {
    lease.release()
  }
}

async function collectMemoryMap(
  memory: ResolvedMemory,
  context: MemoryOperationContext,
  collected: MemoryMapCollection,
): Promise<void> {
  const targets = [memory.global]
  if (memory.project) targets.push(memory.project)
  for (const target of targets) {
    if (memoryOperationInterruption(context)) return
    await collectVaultMap(target, context, collected)
  }
}

async function collectVaultMap(
  target: ResolvedVault,
  context: MemoryOperationContext,
  collected: MemoryMapCollection,
): Promise<void> {
  const inventory = await enumerateVault(target.vault)
  if (!inventory.succeeded) {
    collected.problems.push(...inventory.problems)
    return
  }
  for (const failure of inventory.output.failures) collected.problems.push(...failure.problems)
  for (const entry of inventory.output.entries) {
    if (memoryOperationInterruption(context)) return
    if (entry.kind !== "note" || entry.archived) continue
    await collectMapNote(target, entry.path, collected)
  }
}

async function collectMapNote(target: ResolvedVault, path: string, collected: MemoryMapCollection): Promise<void> {
  const inspected = await inspectVaultFile(target.vault, { path })
  if (!inspected.succeeded) {
    collected.problems.push(...inspected.problems)
    return
  }
  const { analysis, archived } = inspected.output
  if (archived || analysis.status !== "parsed" || !analysis.frontmatter || !analysis.searchable) return
  collected.notes.push({
    scope: target.scope,
    id: analysis.frontmatter.id,
    path: inspected.output.canonicalPath,
    statement: analysis.parsed.statement,
  })
}

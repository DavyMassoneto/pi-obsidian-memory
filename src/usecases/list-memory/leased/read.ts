import { readFolderIndex } from "#src/services"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { ResolvedVault } from "#src/usecases/resolve-memory"
import type { ListMemoryResult } from "./types.ts"

export async function readLeasedFolder(
  target: ResolvedVault,
  folder: string,
  context: MemoryOperationContext,
): Promise<ListMemoryResult> {
  const result = await readFolderIndex(target.vault, { folder })
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!result.succeeded) return result
  return { succeeded: true, output: { kind: "folder", vault: target.scope, ...result.output } }
}

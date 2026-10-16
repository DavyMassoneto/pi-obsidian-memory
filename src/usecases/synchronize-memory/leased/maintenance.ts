import { refreshFolders } from "#/services"
import { memoryOperationInterruption } from "#/usecases/operation-context"
import type { CatalogSynchronization, SynchronizationScan } from "./types.ts"

export async function maintainMemoryFolders(work: CatalogSynchronization, scan: SynchronizationScan): Promise<void> {
  const folders = [...scan.enumeration.completeDirectories].sort()
  if (folders.length === 0 || memoryOperationInterruption(work.context)) return
  const refreshed = await refreshFolders(work.target.vault, folders, () => !memoryOperationInterruption(work.context))
  if (!refreshed.succeeded) work.progress.warnings.push(...refreshed.problems)
  else if (refreshed.maintenanceProblems) work.progress.warnings.push(...refreshed.maintenanceProblems)
}

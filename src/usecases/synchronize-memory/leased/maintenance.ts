import {
  FOLDER_INDEX_FORMAT,
  type FolderIndexState,
  folderListingFingerprints,
  readFolderIndexStates,
  recordFolderIndexStates,
  refreshFolders,
} from "#src/services"
import { memoryOperationInterruption } from "#src/usecases/operation-context"
import { dirtyFolders, settledStates } from "./folder-states.ts"
import type { CatalogSynchronization, SynchronizationScan } from "./types.ts"

export async function maintainMemoryFolders(work: CatalogSynchronization, scan: SynchronizationScan): Promise<void> {
  const folders = [...scan.enumeration.completeDirectories].sort()
  if (folders.length === 0 || memoryOperationInterruption(work.context)) return
  const renderKey = JSON.stringify([FOLDER_INDEX_FORMAT, work.target.vault.name, scan.catalog.validationFingerprint])
  const fingerprints = folderListingFingerprints(scan.enumeration, renderKey)
  const stored = readFolderIndexStates(work.index)
  let known: FolderIndexState[] = []
  if (stored.succeeded) known = stored.output
  else {
    work.progress.warnings.push(...stored.problems)
    const cleared = recordFolderIndexStates(work.index, [], [])
    if (!cleared.succeeded) work.progress.warnings.push(...cleared.problems)
  }
  const dirty = dirtyFolders(scan.enumeration, fingerprints, known).sort()
  let settled: FolderIndexState[] = []
  if (dirty.length > 0) {
    const refreshed = await refreshFolders(
      work.target.vault,
      dirty,
      () => !memoryOperationInterruption(work.context),
      "exact",
    )
    if (!refreshed.succeeded) work.progress.warnings.push(...refreshed.problems)
    else if (refreshed.maintenanceProblems) work.progress.warnings.push(...refreshed.maintenanceProblems)
    settled = settledStates(fingerprints, refreshed.refreshed)
  }
  const recorded = recordFolderIndexStates(work.index, settled, folders)
  if (!recorded.succeeded) work.progress.warnings.push(...recorded.problems)
}

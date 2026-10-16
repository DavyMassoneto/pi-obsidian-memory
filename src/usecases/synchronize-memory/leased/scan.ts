import { type CatalogSnapshot, enumerateVault } from "#/services"
import { memoryOperationInterruption } from "#/usecases/operation-context"
import { inspectScanAliases, recordAliasFailure } from "./aliases.ts"
import { inspectScanEntries } from "./inspection.ts"
import type { CatalogSynchronization, SynchronizationScan, SynchronizationScanResult } from "./types.ts"

export async function scanMemoryCatalog(
  work: CatalogSynchronization,
  snapshot: CatalogSnapshot,
  validationFingerprint: string,
): Promise<SynchronizationScanResult> {
  const enumerated = await enumerateVault(work.target.vault)
  const interrupted = memoryOperationInterruption(work.context)
  if (interrupted) return interrupted
  if (!enumerated.succeeded) return enumerated
  const enumeration = enumerated.output
  const scan: SynchronizationScan = {
    enumeration,
    catalog: {
      entries: [],
      observedPaths: enumeration.observedPaths,
      completeDirectories: enumeration.completeDirectories,
      failedPaths: [],
      untraversedAliasDirectories: [],
      excludedAliasFiles: [],
      complete: true,
      validationFingerprint,
    },
    warnings: [],
  }
  for (const failure of enumeration.failures) recordAliasFailure(scan, failure)
  const inspected = await inspectScanEntries(work, snapshot, scan)
  const stale = memoryOperationInterruption(work.context)
  if (stale) return stale
  if (!inspected.succeeded) return inspected
  return inspectScanAliases(work, scan)
}

import { type CatalogSnapshot, inspectedCatalogEntry, inspectVaultFile, reusableCatalogEntry } from "#/services"
import { memoryOperationInterruption } from "#/usecases/operation-context"
import type { CatalogSynchronization, SynchronizationScan, SynchronizationScanResult } from "./types.ts"

export async function inspectScanEntries(
  work: CatalogSynchronization,
  snapshot: CatalogSnapshot,
  scan: SynchronizationScan,
): Promise<SynchronizationScanResult> {
  const previous = new Map(snapshot.entries.map((entry) => [entry.path, entry]))
  for (const file of scan.enumeration.entries) {
    if (file.kind !== "note") continue
    const interrupted = memoryOperationInterruption(work.context)
    if (interrupted) return interrupted
    const cached = previous.get(file.path)
    if (cached && reusableCatalogEntry(file, cached, scan.catalog.validationFingerprint)) {
      scan.catalog.entries.push(cached)
      continue
    }
    const inspected = await inspectVaultFile(work.target.vault, { path: file.path })
    const stale = memoryOperationInterruption(work.context)
    if (stale) return stale
    if (inspected.succeeded) {
      scan.catalog.entries.push(inspectedCatalogEntry(inspected.output, scan.catalog.validationFingerprint))
    } else {
      scan.catalog.failedPaths.push(file.path)
      scan.catalog.complete = false
      scan.warnings.push(...inspected.problems)
    }
  }
  return { succeeded: true, output: scan }
}

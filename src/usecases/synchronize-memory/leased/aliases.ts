import {
  classifyAliasFailure,
  inspectedCatalogEntry,
  inspectVaultFile,
  observeVaultPath,
  type VaultCatalogFailure,
} from "#src/services"
import { memoryOperationInterruption } from "#src/usecases/operation-context"
import type { CatalogSynchronization, SynchronizationScan, SynchronizationScanResult } from "./types.ts"

export async function inspectScanAliases(
  work: CatalogSynchronization,
  scan: SynchronizationScan,
): Promise<SynchronizationScanResult> {
  for (const alias of scan.enumeration.aliases) {
    const interrupted = memoryOperationInterruption(work.context)
    if (interrupted) return interrupted
    const observed = await observeVaultPath(work.target.vault, { path: alias.path })
    const stale = memoryOperationInterruption(work.context)
    if (stale) return stale
    if (!observed.succeeded) {
      recordAliasFailure(scan, observed)
    } else if (observed.output.kind === "directory") {
      scan.catalog.untraversedAliasDirectories.push(alias.path)
    } else {
      await inspectAliasFile(work, scan, alias.path)
      const cancelled = memoryOperationInterruption(work.context)
      if (cancelled) return cancelled
    }
  }
  return { succeeded: true, output: scan }
}

async function inspectAliasFile(work: CatalogSynchronization, scan: SynchronizationScan, path: string): Promise<void> {
  const inspected = await inspectVaultFile(work.target.vault, { path })
  if (memoryOperationInterruption(work.context)) return
  if (inspected.succeeded) {
    scan.catalog.entries.push(inspectedCatalogEntry(inspected.output, scan.catalog.validationFingerprint))
  } else {
    recordAliasFailure(scan, inspected)
  }
}

export function recordAliasFailure(scan: SynchronizationScan, failure: VaultCatalogFailure): void {
  const classified = classifyAliasFailure(failure)
  if (classified.kind === "untraversed-directory") {
    scan.catalog.untraversedAliasDirectories.push(classified.path)
  } else if (classified.kind === "excluded-file") {
    scan.catalog.excludedAliasFiles.push(classified.path)
  } else {
    scan.catalog.failedPaths.push(classified.path)
    scan.catalog.complete = false
    scan.warnings.push(...classified.problems)
  }
}

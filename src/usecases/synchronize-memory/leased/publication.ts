import {
  applyIndexChanges,
  type CatalogPlan,
  type CatalogScan,
  type CatalogSnapshot,
  readIndexInventory,
  reconcileCatalog,
} from "#/services"
import { memoryOperationInterruption } from "#/usecases/operation-context"
import type { CatalogPublicationResult, CatalogSynchronization } from "./types.ts"

export function publishMemoryCatalog(
  work: CatalogSynchronization,
  snapshot: CatalogSnapshot,
  scan: CatalogScan,
): CatalogPublicationResult {
  const first = publishPlan(work, snapshot, scan)
  if (first.succeeded || first.reason !== "conflict") return first
  const interrupted = memoryOperationInterruption(work.context)
  if (interrupted) return interrupted
  const latest = readIndexInventory(work.index)
  if (!latest.succeeded) return latest
  return publishPlan(work, latest.output, scan)
}

function publishPlan(
  work: CatalogSynchronization,
  snapshot: CatalogSnapshot,
  scan: CatalogScan,
): CatalogPublicationResult {
  const plan = reconcileCatalog(snapshot, scan)
  const interrupted = memoryOperationInterruption(work.context)
  if (interrupted) return interrupted
  if (catalogChanged(plan, snapshot)) {
    const applied = applyIndexChanges(work.index, plan)
    if (!applied.succeeded) return applied
    work.progress.committed = true
    work.progress.revision = snapshot.revision + 1
  } else {
    work.progress.revision = snapshot.revision
  }
  work.progress.population = plan.population
  work.progress.duplicateIds = plan.duplicateIds
  if (scan.complete && plan.reinspectPaths.length === 0) work.progress.coverage = "complete"
  return { succeeded: true, output: plan }
}

function catalogChanged(plan: CatalogPlan, snapshot: CatalogSnapshot): boolean {
  return (
    plan.upserts.length > 0 ||
    plan.deletes.length > 0 ||
    plan.statUpdates.length > 0 ||
    plan.population !== snapshot.population
  )
}

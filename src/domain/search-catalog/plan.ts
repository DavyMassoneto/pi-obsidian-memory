import { catalogFolder, confirmedMissing } from "./coverage.ts"
import type { CatalogEntry, CatalogPlan, CatalogScan, CatalogSnapshot, DuplicateCatalogId } from "./types.ts"

export function planCatalogChanges(snapshot: CatalogSnapshot, scan: CatalogScan): CatalogPlan {
  const previous = new Map(snapshot.entries.map((entry) => [entry.path, entry]))
  const plan: CatalogPlan = {
    expectedRevision: snapshot.revision,
    upserts: [],
    deletes: [],
    statUpdates: [],
    duplicateIds: [],
    reinspectPaths: [],
    touchedFolders: [],
    population: snapshot.population,
  }

  for (const entry of scan.entries) classifyEntry(entry, previous.get(entry.path), plan)
  plan.deletes = snapshot.entries.filter((entry) => confirmedMissing(entry.path, scan)).map((entry) => entry.path)

  const current = new Map(previous)
  for (const path of plan.deletes) current.delete(path)
  for (const entry of scan.entries) current.set(entry.path, entry)

  plan.reinspectPaths = [...current.values()]
    .filter((entry) => entry.validationFingerprint !== scan.validationFingerprint)
    .map((entry) => entry.path)
  if (scan.complete && scan.failedPaths.length === 0 && plan.reinspectPaths.length === 0) plan.population = "ready"

  plan.duplicateIds = duplicateIds([...current.values()])
  plan.touchedFolders = [
    ...new Set([...plan.deletes, ...plan.upserts.map((entry) => entry.path)].map(catalogFolder)),
  ].sort()

  return plan
}

function classifyEntry(entry: CatalogEntry, previous: CatalogEntry | undefined, plan: CatalogPlan): void {
  if (!previous || !sameContent(entry, previous)) {
    plan.upserts.push(entry)
    return
  }

  if (entry.stat.size !== previous.stat.size || entry.stat.mtimeMs !== previous.stat.mtimeMs) {
    plan.statUpdates.push({ path: entry.path, stat: entry.stat })
  }
}

function sameContent(left: CatalogEntry, right: CatalogEntry): boolean {
  return (
    left.rawHash === right.rawHash &&
    left.validationFingerprint === right.validationFingerprint &&
    left.contentFingerprint === right.contentFingerprint &&
    left.needsFixing === right.needsFixing &&
    JSON.stringify(left.note) === JSON.stringify(right.note)
  )
}

function duplicateIds(entries: CatalogEntry[]): DuplicateCatalogId[] {
  const paths = new Map<string, string[]>()
  for (const entry of entries) {
    if (!entry.note) continue
    const group = paths.get(entry.note.id)
    if (group) group.push(entry.path)
    else paths.set(entry.note.id, [entry.path])
  }

  return [...paths]
    .filter(([, group]) => group.length > 1)
    .map(([id, group]) => ({ id, paths: group.sort() }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

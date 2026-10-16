import { Value } from "typebox/value"

import type { CatalogChanges, CatalogEntry } from "#src/domain"
import { catalogFolder } from "#src/domain"
import type { prepareCatalogStatements } from "./catalog-statements.ts"
import { corruptCatalog, validCatalogEntry } from "./inventory.ts"
import { CatalogChangesSchema, CatalogStateSchema } from "./schemas.ts"
import type { CatalogWriteRow, IndexWriteResult } from "./types.ts"

export function writeCatalog(
  statements: ReturnType<typeof prepareCatalogStatements>,
  changes: CatalogChanges,
): IndexWriteResult {
  if (!validChanges(changes)) return invalidCatalog("the catalog changes are invalid or overlap")
  const state = statements.state.get()
  if (!Value.Check(CatalogStateSchema, state)) return corruptCatalog()
  if (state.revision !== changes.expectedRevision) return staleCatalog()

  for (const path of changes.deletes) statements.remove.run(path)
  for (const entry of changes.upserts) writeCatalogEntry(statements, entry)
  for (const update of changes.statUpdates) {
    const result = statements.stat.run(update.stat.size, update.stat.mtimeMs, update.path)
    if (result.changes !== 1) return invalidCatalog("stat updates require an existing path")
  }
  statements.prune.run()
  statements.advance.run(changes.population)
  return { succeeded: true }
}

function validChanges(changes: CatalogChanges): boolean {
  const shape = {
    expectedRevision: changes.expectedRevision,
    upserts: changes.upserts,
    deletes: changes.deletes,
    statUpdates: changes.statUpdates,
    population: changes.population,
  }
  if (!Value.Check(CatalogChangesSchema, shape)) return false
  const paths = [
    ...changes.deletes,
    ...changes.upserts.map((entry) => entry.path),
    ...changes.statUpdates.map((update) => update.path),
  ]
  return (
    new Set(paths).size === paths.length &&
    changes.upserts.every(validCatalogEntry) &&
    changes.statUpdates.every((update) => Number.isFinite(update.stat.mtimeMs))
  )
}

export function writeCatalogEntry(statements: ReturnType<typeof prepareCatalogStatements>, entry: CatalogEntry): void {
  const row = emptyNoteRow(entry)
  if (entry.note) {
    row.id = entry.note.id
    row.type = entry.note.type
    row.statement = entry.note.statement
    row.body = entry.note.body
    row.dont_forget = 0
    row.archived = 0
    if (entry.note.dontForget) row.dont_forget = 1
    if (entry.note.archived) row.archived = 1
  }
  statements.put.run({ ...row })
}

function emptyNoteRow(entry: CatalogEntry): CatalogWriteRow {
  const row: CatalogWriteRow = {
    path: entry.path,
    folder: catalogFolder(entry.path),
    id: null,
    type: null,
    statement: null,
    body: null,
    dont_forget: null,
    archived: null,
    size: entry.stat.size,
    modified_ms: entry.stat.mtimeMs,
    hash: entry.rawHash,
    content_fingerprint: entry.contentFingerprint,
    validation_fingerprint: entry.validationFingerprint,
    needs_fixing: 0,
  }
  if (entry.needsFixing) row.needs_fixing = 1
  return row
}

export function invalidCatalog(problem: string): IndexWriteResult {
  return { succeeded: false, reason: "invalid", problems: [problem] }
}

export function staleCatalog(): IndexWriteResult {
  return { succeeded: false, reason: "conflict", problems: ["the catalog changed since its inventory was read"] }
}

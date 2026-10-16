import { Value } from "typebox/value"

import { type CatalogEntry, CatalogEntrySchema, CatalogNoteSchema } from "#/domain"
import type { prepareCatalogStatements } from "./catalog-statements.ts"
import { CatalogRowSchema, CatalogStateSchema } from "./schemas.ts"
import type { CatalogRow, InventoryResult, SearchIndexRefusal } from "./types.ts"

export function readInventory(statements: ReturnType<typeof prepareCatalogStatements>): InventoryResult {
  const state = statements.state.get()
  if (!Value.Check(CatalogStateSchema, state)) return corruptCatalog()

  const entries: CatalogEntry[] = []
  for (const row of statements.inventory.all()) {
    if (!Value.Check(CatalogRowSchema, row)) return corruptCatalog()
    const entry = entryFromRow(row)
    if (!entry || !validCatalogEntry(entry)) return corruptCatalog()
    entries.push(entry)
  }
  return { succeeded: true, output: { ...state, entries } }
}

export function validCatalogEntry(entry: CatalogEntry): boolean {
  if (!Value.Check(CatalogEntrySchema, entry) || !Number.isFinite(entry.stat.mtimeMs)) return false
  if (!entry.note) return !entry.contentFingerprint && entry.needsFixing
  if (!entry.contentFingerprint) return false
  return entry.note.archived || entry.path.split("/")[0]?.toLowerCase() !== "archive"
}

function entryFromRow(row: CatalogRow): CatalogEntry | null {
  const entry: CatalogEntry = {
    path: row.path,
    stat: { size: row.size, mtimeMs: row.modified_ms },
    rawHash: row.hash,
    contentFingerprint: row.content_fingerprint,
    validationFingerprint: row.validation_fingerprint,
    needsFixing: row.needs_fixing === 1,
    note: null,
  }
  if (!row.id) {
    const columns = [row.type, row.statement, row.body, row.dont_forget, row.archived]
    if (columns.some((value) => typeof value === "string" || typeof value === "number")) return null
    return entry
  }
  const note = noteFromRow(row)
  if (!note) return null
  entry.note = note
  return entry
}

function noteFromRow(row: CatalogRow): CatalogEntry["note"] {
  if (typeof row.dont_forget !== "number" || typeof row.archived !== "number") return null
  const note = {
    id: row.id,
    type: row.type,
    statement: row.statement,
    body: row.body,
    dontForget: row.dont_forget === 1,
    archived: row.archived === 1,
  }
  if (!Value.Check(CatalogNoteSchema, note)) return null
  return note
}

export function corruptCatalog(): SearchIndexRefusal {
  return { succeeded: false, reason: "corrupted", problems: ["the catalog does not match its schema"] }
}

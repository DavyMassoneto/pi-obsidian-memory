import { Value } from "typebox/value"

import { type CatalogEntry, semanticFingerprint } from "#/domain"
import type { prepareCatalogStatements } from "./catalog-statements.ts"
import { validCatalogEntry } from "./inventory.ts"
import { invalidCatalog, writeCatalogEntry } from "./reconcile.ts"
import { IndexEntrySchema } from "./schemas.ts"
import type { prepareStatements } from "./statements.ts"
import type { IndexEntry, IndexWriteResult } from "./types.ts"

export function putLegacyEntry(
  statements: ReturnType<typeof prepareStatements>,
  catalog: ReturnType<typeof prepareCatalogStatements>,
  entry: IndexEntry,
): IndexWriteResult {
  if (!Value.Check(IndexEntrySchema, entry) || !Number.isFinite(entry.modifiedMs)) {
    return invalidCatalog("the entry does not match the index schema")
  }
  if (statements.byId.all(entry.id).length > 1) {
    return invalidCatalog("duplicate ids require a path-keyed catalog mutation")
  }
  const converted = legacyEntry(entry)
  if (!validCatalogEntry(converted)) return invalidCatalog("the entry does not have a valid catalog path")
  statements.move.run(converted.path, entry.id)
  writeCatalogEntry(catalog, converted)
  statements.folder.run(entry.folder, converted.path)
  catalog.prune.run()
  catalog.advance.run("needs-population")
  return { succeeded: true }
}

export function removeLegacyEntry(
  statements: ReturnType<typeof prepareStatements>,
  catalog: ReturnType<typeof prepareCatalogStatements>,
  id: string,
): IndexWriteResult {
  if (statements.byId.all(id).length > 1) return invalidCatalog("duplicate ids require a path-keyed catalog mutation")
  statements.remove.run({ id })
  catalog.prune.run()
  catalog.advance.run("needs-population")
  return { succeeded: true }
}

function legacyEntry(entry: IndexEntry): CatalogEntry {
  let path = `${entry.statement}.md`
  if (entry.folder !== "") path = `${entry.folder}/${path}`
  if (entry.archived && path.split("/")[0]?.toLowerCase() !== "archive") path = `archive/${path}`
  return {
    path,
    stat: { size: entry.size, mtimeMs: entry.modifiedMs },
    rawHash: entry.hash,
    contentFingerprint: semanticFingerprint(entry),
    validationFingerprint: "legacy-unvalidated",
    needsFixing: false,
    note: {
      id: entry.id,
      statement: entry.statement,
      body: entry.body,
      type: entry.type,
      dontForget: entry.dontForget,
      archived: entry.archived,
    },
  }
}

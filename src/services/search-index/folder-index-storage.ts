import { Value } from "typebox/value"

import type { prepareFolderIndexStatements } from "./folder-index-statements.ts"
import { corruptCatalog } from "./inventory.ts"
import { invalidCatalog } from "./reconcile.ts"
import { FolderIndexRowSchema, FolderIndexWriteSchema } from "./schemas.ts"
import type { FolderIndexState, FolderIndexStatesResult, IndexWriteResult } from "./types.ts"

export function readStoredFolderIndexes(
  statements: ReturnType<typeof prepareFolderIndexStatements>,
): FolderIndexStatesResult {
  const states: FolderIndexState[] = []
  for (const row of statements.all.all()) {
    if (
      !Value.Check(FolderIndexRowSchema, row) ||
      !Number.isFinite(row.index_mtime_ms) ||
      !Number.isFinite(row.index_ctime_ms)
    )
      return corruptCatalog()
    states.push({
      folder: row.folder,
      fingerprint: row.fingerprint,
      indexSize: row.index_size,
      indexMtimeMs: row.index_mtime_ms,
      indexCtimeMs: row.index_ctime_ms,
      indexIno: row.index_ino,
    })
  }
  return { succeeded: true, output: states }
}

export function writeFolderIndexStates(
  statements: ReturnType<typeof prepareFolderIndexStatements>,
  states: FolderIndexState[],
  keepFolders: string[],
): IndexWriteResult {
  const valid =
    Value.Check(FolderIndexWriteSchema, { states, keepFolders }) &&
    states.every((state) => Number.isFinite(state.indexMtimeMs) && Number.isFinite(state.indexCtimeMs))
  if (!valid) return invalidCatalog("the folder index states are invalid")

  for (const state of states) {
    statements.put.run(
      state.folder,
      state.fingerprint,
      state.indexSize,
      state.indexMtimeMs,
      state.indexCtimeMs,
      state.indexIno,
    )
  }
  statements.prune.run(JSON.stringify(keepFolders))
  return { succeeded: true }
}

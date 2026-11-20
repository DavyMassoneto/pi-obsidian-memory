import { mkdirSync, realpathSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import {
  HELD_INDEX_LOCKS,
  INDEX_LOCK_EXTENSION,
  INDEX_LOCK_TIMEOUT_MS,
  SQLITE_BUSY,
  SQLITE_PRIMARY_CODE_MASK,
} from "./constants.ts"
import { indexFailure } from "./refusals.ts"
import type { IndexLockResult } from "./types.ts"

export function acquireIndexLock(indexPath: string): IndexLockResult {
  try {
    const lockPath = lockPathFor(indexPath)
    if (HELD_INDEX_LOCKS.has(lockPath)) {
      return {
        succeeded: false,
        reason: "unavailable",
        problems: [`This process already holds the index lock: ${lockPath}`],
      }
    }
    const database = new DatabaseSync(lockPath, { timeout: INDEX_LOCK_TIMEOUT_MS })
    try {
      waitForExclusive(database)
    } catch (error) {
      closeQuietly(database)
      throw error
    }
    HELD_INDEX_LOCKS.add(lockPath)
    return { succeeded: true, output: { release: () => release(database, lockPath) } }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}

function lockPathFor(indexPath: string): string {
  const folder = dirname(indexPath)
  mkdirSync(folder, { recursive: true })
  const realFolder = realpathSync.native(folder)
  return join(dirname(realFolder), `${basename(realFolder)}.${basename(indexPath)}${INDEX_LOCK_EXTENSION}`)
}

function waitForExclusive(database: DatabaseSync): void {
  for (;;) {
    try {
      database.exec("BEGIN EXCLUSIVE")
      return
    } catch (error) {
      if (!(error instanceof Error) || !isBusy(error)) throw error
    }
  }
}

function isBusy(error: Error): boolean {
  return (
    "errcode" in error &&
    typeof error.errcode === "number" &&
    (error.errcode & SQLITE_PRIMARY_CODE_MASK) === SQLITE_BUSY
  )
}

function release(database: DatabaseSync, lockPath: string): void {
  HELD_INDEX_LOCKS.delete(lockPath)
  try {
    if (database.isTransaction) database.exec("ROLLBACK")
  } finally {
    closeQuietly(database)
  }
}

function closeQuietly(database: DatabaseSync): void {
  try {
    database.close()
  } catch (error) {
    if (!(error instanceof Error)) throw error
  }
}

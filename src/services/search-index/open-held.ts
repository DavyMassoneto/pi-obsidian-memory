import { lstatSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { closeFailedIndex } from "./cleanup.ts"
import { LockedSearchIndex } from "./locked-index.ts"
import { indexFailure } from "./refusals.ts"
import { initializeSchema } from "./schema.ts"
import { SqliteSearchIndex } from "./storage.ts"
import type { HeldOpenResult, SearchIndexRefusal } from "./types.ts"

export function checkIndexPath(path: string): SearchIndexRefusal | null {
  try {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (lstatSync(`${path}${suffix}`, { throwIfNoEntry: false })?.isSymbolicLink()) {
        return {
          succeeded: false,
          reason: "unavailable",
          problems: [`Index path must not be a link: ${path}${suffix}`],
        }
      }
    }
    mkdirSync(dirname(path), { recursive: true })
    return null
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}

export function openHeldIndex(path: string): HeldOpenResult {
  try {
    return initializeIndex(new DatabaseSync(path), path)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}

function initializeIndex(database: DatabaseSync, path: string): HeldOpenResult {
  try {
    const schema = initializeSchema(database)
    if (!schema.succeeded) {
      return closeFailedIndex(database, schema)
    }

    return {
      succeeded: true,
      output: new LockedSearchIndex(new SqliteSearchIndex(database), path),
      rebuilt: schema.output,
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return closeFailedIndex(database, indexFailure(error))
  }
}

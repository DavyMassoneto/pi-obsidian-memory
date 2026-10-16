import { lstatSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { closeFailedIndex } from "./cleanup.ts"
import { indexFailure } from "./refusals.ts"
import { initializeSchema } from "./schema.ts"
import { SqliteSearchIndex } from "./storage.ts"
import type { OpenIndexResult } from "./types.ts"

export function openIndex(path: string): OpenIndexResult {
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
    return initializeIndex(new DatabaseSync(path))
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    return indexFailure(error)
  }
}

function initializeIndex(database: DatabaseSync): OpenIndexResult {
  try {
    const schema = initializeSchema(database)
    if (!schema.succeeded) {
      return closeFailedIndex(database, schema)
    }

    return { succeeded: true, output: new SqliteSearchIndex(database), rebuilt: schema.output }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    return closeFailedIndex(database, indexFailure(error))
  }
}

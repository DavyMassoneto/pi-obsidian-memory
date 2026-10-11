import type { DatabaseSync } from "node:sqlite"

import { INDEX_SCHEMA_VERSION, REBUILD_SCHEMA_SQL } from "./constants.ts"
import { indexFailure } from "./refusals.ts"
import type { SchemaResult, SearchIndexRefusal } from "./types.ts"

export function initializeSchema(database: DatabaseSync): SchemaResult {
  try {
    database.exec("BEGIN IMMEDIATE")
    const row = database.prepare("PRAGMA user_version").get()
    if (!row || typeof row.user_version !== "number") {
      return rollBackSchema(database, {
        succeeded: false,
        reason: "corrupted",
        problems: ["the search index has no valid schema version"],
      })
    }

    const rebuilt = row.user_version !== INDEX_SCHEMA_VERSION
    if (rebuilt) {
      database.exec(REBUILD_SCHEMA_SQL)
    }
    database.exec("COMMIT")
    return { succeeded: true, output: rebuilt }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return rollBackSchema(database, indexFailure(error))
  }
}

function rollBackSchema(database: DatabaseSync, failure: SearchIndexRefusal): SearchIndexRefusal {
  if (!database.isTransaction) return failure

  try {
    database.exec("ROLLBACK")
  } catch (error) {
    if (!(error instanceof Error)) throw error
    failure.problems.push(`schema rollback failed: ${error.message}`)
  }
  return failure
}

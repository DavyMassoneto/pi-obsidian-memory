import type { DatabaseSync } from "node:sqlite"

import type { SearchIndexRefusal } from "./types.ts"

export function closeFailedIndex(database: DatabaseSync, failure: SearchIndexRefusal): SearchIndexRefusal {
  try {
    database.close()
  } catch (error) {
    if (!(error instanceof Error)) throw error
    failure.problems.push(`closing the search index failed: ${error.message}`)
  }
  return failure
}

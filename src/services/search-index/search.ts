import { eng, removeStopwords } from "stopword"
import { Value } from "typebox/value"

import { BODY_WEIGHT, STATEMENT_WEIGHT, WORD_PATTERN } from "./constants.ts"
import { SearchIndexCorruptedError } from "./errors.ts"
import { SearchHitSchema } from "./schemas.ts"
import type { SearchHit, SearchIndex, SearchOptions } from "./types.ts"

export function searchText(index: SearchIndex, query: string, options: SearchOptions): SearchHit[] {
  const terms = searchTermsOf(query)
  if (terms.length === 0) {
    return []
  }

  const match = terms.map((term) => `"${term}"`).join(" OR ")
  const includeArchived = Number(options.includeArchived)

  const rows = index
    .prepare(`
      SELECT notes.id, notes.folder, notes.statement, notes.type,
        -bm25(notes_fts, 0, :statementWeight, :bodyWeight) AS score
      FROM notes_fts
      JOIN notes ON notes.id = notes_fts.id
      WHERE notes_fts MATCH :match AND (notes.archived = 0 OR :includeArchived = 1)
      ORDER BY score DESC
      LIMIT :limit
    `)
    .all({ match, includeArchived, limit: options.limit, statementWeight: STATEMENT_WEIGHT, bodyWeight: BODY_WEIGHT })
  return rows.map(toSearchHit)
}

function searchTermsOf(query: string): string[] {
  const words = query.toLowerCase().match(WORD_PATTERN)
  if (!words) {
    return []
  }

  return removeStopwords([...new Set(words)], eng)
}

function toSearchHit(row: object): SearchHit {
  if (!Value.Check(SearchHitSchema, row)) {
    throw new SearchIndexCorruptedError("a search result does not match the index schema; rebuild the index")
  }

  return row
}

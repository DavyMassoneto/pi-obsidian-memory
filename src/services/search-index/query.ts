import type { StatementSync } from "node:sqlite"

import { eng, removeStopwords } from "stopword"
import { Value } from "typebox/value"

import { BODY_WEIGHT, STATEMENT_WEIGHT, WORD_PATTERN } from "./constants.ts"
import { SearchHitSchema, SearchOptionsSchema } from "./schemas.ts"
import type { SearchHit, SearchOptions, SearchResult } from "./types.ts"

export function readSearchHits(statement: StatementSync, query: string, options: SearchOptions): SearchResult {
  if (!Value.Check(SearchOptionsSchema, options)) {
    return { succeeded: false, reason: "invalid", problems: ["search options require a positive integer limit"] }
  }

  const terms = searchTermsOf(query)
  if (terms.length === 0) return { succeeded: true, output: [] }

  const rows = statement.all({
    match: terms.map((term) => `"${term}"`).join(" OR "),
    includeArchived: Number(options.includeArchived),
    limit: options.limit,
    statementWeight: STATEMENT_WEIGHT,
    bodyWeight: BODY_WEIGHT,
  })
  const hits: SearchHit[] = []
  for (const row of rows) {
    if (!Value.Check(SearchHitSchema, row) || !Number.isFinite(row.score)) {
      return { succeeded: false, reason: "corrupted", problems: ["a search result does not match the index schema"] }
    }
    hits.push(row)
  }
  return { succeeded: true, output: hits }
}

function searchTermsOf(query: string): string[] {
  const words = query.toLowerCase().match(WORD_PATTERN)
  if (!words) return []

  return removeStopwords([...new Set(words)], eng)
}

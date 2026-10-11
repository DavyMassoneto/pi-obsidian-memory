import type { StatementSync } from "node:sqlite"

import { Value } from "typebox/value"

import { BODY_WEIGHT, STATEMENT_WEIGHT } from "./constants.ts"
import { corruptCatalog } from "./inventory.ts"
import { searchTermsOf } from "./query.ts"
import { CatalogHitRowSchema } from "./schemas.ts"
import type { CatalogHit, CatalogQuery, CatalogSearchResult } from "./types.ts"

export function readCatalogHits(statement: StatementSync, request: CatalogQuery): CatalogSearchResult {
  if (!Number.isSafeInteger(request.limit) || request.limit < 1) {
    return { succeeded: false, reason: "invalid", problems: ["search requires a positive integer limit"] }
  }
  const terms = searchTermsOf(request.query)
  if (terms.length === 0) return { succeeded: true, output: [] }
  const rows = statement.all({
    match: terms.map((term) => `"${term}"`).join(" OR "),
    limit: request.limit,
    statementWeight: STATEMENT_WEIGHT,
    bodyWeight: BODY_WEIGHT,
  })
  const hits: CatalogHit[] = []
  for (const row of rows) {
    if (!Value.Check(CatalogHitRowSchema, row) || !Number.isFinite(row.score)) return corruptCatalog()
    const hit = {
      path: row.path,
      id: row.id,
      statement: row.statement,
      type: row.type,
      score: row.score,
      dontForget: row.dont_forget === 1,
      needsFixing: row.needs_fixing === 1,
    }
    hits.push(hit)
  }
  return { succeeded: true, output: hits }
}

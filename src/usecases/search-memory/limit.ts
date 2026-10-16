import type { QueryVector } from "#src/usecases/semantic"
import { SEMANTIC_CANDIDATES } from "#src/usecases/semantic"
import { SEARCH_RESULT_LIMIT } from "./constants.ts"

export function textLimitFor(query: QueryVector | null): number {
  if (query) return SEMANTIC_CANDIDATES
  return SEARCH_RESULT_LIMIT
}

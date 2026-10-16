import type { CatalogHit } from "#src/services"

export interface QueryVector {
  fingerprint: string
  vector: number[]
}

export interface SemanticRanked {
  paths: string[]
  hits: CatalogHit[]
  problems: string[]
}

export interface SemanticSearch {
  query: QueryVector | null
  problems: string[]
}

import type { CatalogHit, MemoryScope } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"
import type { QueryVector } from "#src/usecases/semantic"
import type { SemanticPort } from "#src/usecases/semantic-port"

export interface SearchMemoryRequest {
  query: string
  vault: MemoryScope | "both"
}

export interface VaultSearchHits {
  vault: MemoryScope
  hits: CatalogHit[]
  warnings: string[]
}

export interface VaultSearchFailure {
  vault: MemoryScope
  problems: string[]
}

export interface SemanticSummary {
  mode: "fused" | "text-only"
  problems: string[]
}

export interface SearchedMemory {
  vaults: (VaultSearchHits | VaultSearchFailure)[]
  projectMissing: boolean
  semantic: SemanticSummary
}

export interface VaultSemantic {
  port: SemanticPort | null
  query: QueryVector | null
}

export type SearchMemoryResult = Succeeded<SearchedMemory> | MemoryResolutionRefusal

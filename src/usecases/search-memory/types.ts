import type { CatalogHit, MemoryScope } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

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

export interface SearchedMemory {
  vaults: (VaultSearchHits | VaultSearchFailure)[]
  projectMissing: boolean
}

export type SearchMemoryResult = Succeeded<SearchedMemory> | MemoryResolutionRefusal

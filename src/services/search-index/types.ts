import type { Static } from "typebox"

import type {
  CatalogChanges,
  CatalogSnapshot,
  VectorCache,
  VectorChunk,
  VectorGeneration,
  VectorReplacement,
} from "#src/domain"
import type { Done, Failed, Succeeded } from "#src/shared"
import type {
  CatalogHitSchema,
  CatalogRowSchema,
  FolderIndexRowSchema,
  FolderIndexStateSchema,
  IndexEntrySchema,
  SearchHitSchema,
  SearchOptionsSchema,
} from "./schemas.ts"

export type {
  AliasFailureClassification,
  CatalogChanges,
  CatalogEntry,
  CatalogPlan,
  CatalogScan,
  CatalogSnapshot,
  SemanticContent,
  VectorCache,
  VectorChunk,
  VectorGeneration,
  VectorReplacement,
} from "#src/domain"
export type CatalogHit = Static<typeof CatalogHitSchema>
export type CatalogRow = Static<typeof CatalogRowSchema>
export type FolderIndexState = Static<typeof FolderIndexStateSchema>
export type FolderIndexRow = Static<typeof FolderIndexRowSchema>
export type FolderIndexStatesResult = Succeeded<FolderIndexState[]> | SearchIndexRefusal
export type InventoryResult = Succeeded<CatalogSnapshot> | SearchIndexRefusal
export type CatalogSearchResult = Succeeded<CatalogHit[]> | SearchIndexRefusal
export type VectorCacheResult = Succeeded<VectorCache> | SearchIndexRefusal
export type VectorCoverageResult = Succeeded<VectorCoverage> | SearchIndexRefusal

export interface VectorUpdate {
  expectedRevision: number
  generation: VectorGeneration
  add: VectorChunk[]
  remove: string[]
}

export interface VectorCoverage {
  generation: VectorGeneration | null
  embedded: number
  current: number
}

export interface IndexLocation {
  path: string
}

export interface IndexReplacement {
  path: string
  temporaryPath: string
}

export interface CatalogQuery {
  query: string
  limit: number
}

export interface CatalogWriteRow extends CatalogRow {
  folder: string
}

export interface SearchIndex {
  put(entry: IndexEntry): IndexWriteResult
  remove(id: string): IndexWriteResult
  search(query: string, options: SearchOptions): SearchResult
  inventory(): InventoryResult
  apply(changes: CatalogChanges): IndexWriteResult
  searchCatalog(request: CatalogQuery): CatalogSearchResult
  vectors(): VectorCacheResult
  replaceVectors(request: VectorReplacement): IndexWriteResult
  updateVectors(request: VectorUpdate): IndexWriteResult
  vectorCoverage(): VectorCoverageResult
  folderIndexes(): FolderIndexStatesResult
  recordFolderIndexes(states: FolderIndexState[], keepFolders: string[]): IndexWriteResult
  close(): IndexWriteResult
}

export type SearchHit = Static<typeof SearchHitSchema>

export type IndexEntry = Static<typeof IndexEntrySchema>

export type SearchOptions = Static<typeof SearchOptionsSchema>

export interface SearchIndexRefusal extends Failed {
  reason: "corrupted" | "unavailable" | "closed" | "invalid" | "conflict"
}

export interface OpenedIndex extends Succeeded<SearchIndex> {
  rebuilt: boolean
}

export type OpenIndexResult = OpenedIndex | SearchIndexRefusal

export type SearchResult = Succeeded<SearchHit[]> | SearchIndexRefusal

export type IndexWriteResult = Done | SearchIndexRefusal

export type SchemaResult = Succeeded<boolean> | SearchIndexRefusal

export type IndexWork = () => IndexWriteResult

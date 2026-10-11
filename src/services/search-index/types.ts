import type { Static } from "typebox"

import type { Done, Failed, Succeeded } from "#/shared"
import type { IndexEntrySchema, SearchHitSchema, SearchOptionsSchema } from "./schemas.ts"

export interface SearchIndex {
  put(entry: IndexEntry): IndexWriteResult
  remove(id: string): IndexWriteResult
  search(query: string, options: SearchOptions): SearchResult
  close(): IndexWriteResult
}

export type SearchHit = Static<typeof SearchHitSchema>

export type IndexEntry = Static<typeof IndexEntrySchema>

export type SearchOptions = Static<typeof SearchOptionsSchema>

export interface SearchIndexRefusal extends Failed {
  reason: "corrupted" | "unavailable" | "closed" | "invalid"
}

export interface OpenedIndex extends Succeeded<SearchIndex> {
  rebuilt: boolean
}

export type OpenIndexResult = OpenedIndex | SearchIndexRefusal

export type SearchResult = Succeeded<SearchHit[]> | SearchIndexRefusal

export type IndexWriteResult = Done | SearchIndexRefusal

export type SchemaResult = Succeeded<boolean> | SearchIndexRefusal

export type IndexWork = () => void

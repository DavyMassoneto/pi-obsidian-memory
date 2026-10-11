import type { SearchIndex, SearchOptions, SearchResult } from "./types.ts"

export function searchText(index: SearchIndex, query: string, options: SearchOptions): SearchResult {
  return index.search(query, options)
}

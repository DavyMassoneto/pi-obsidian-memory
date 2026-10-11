import type { IndexEntry, IndexWriteResult, SearchIndex } from "./types.ts"

export function putNote(index: SearchIndex, entry: IndexEntry): IndexWriteResult {
  return index.put(entry)
}

export function removeNote(index: SearchIndex, id: string): IndexWriteResult {
  return index.remove(id)
}

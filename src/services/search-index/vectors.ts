import type { VectorReplacement } from "#src/domain"
import type { IndexWriteResult, SearchIndex, VectorCacheResult } from "./types.ts"

export function readVectorCache(index: SearchIndex): VectorCacheResult {
  return index.vectors()
}

export function replaceVectorCache(index: SearchIndex, request: VectorReplacement): IndexWriteResult {
  return index.replaceVectors(request)
}

import type { VectorReplacement } from "#src/domain"
import type { IndexWriteResult, SearchIndex, VectorCacheResult, VectorCoverageResult, VectorUpdate } from "./types.ts"

export function readVectorCache(index: SearchIndex): VectorCacheResult {
  return index.vectors()
}

export function replaceVectorCache(index: SearchIndex, request: VectorReplacement): IndexWriteResult {
  return index.replaceVectors(request)
}

export function updateVectorCache(index: SearchIndex, request: VectorUpdate): IndexWriteResult {
  return index.updateVectors(request)
}

export function readVectorCoverage(index: SearchIndex): VectorCoverageResult {
  return index.vectorCoverage()
}

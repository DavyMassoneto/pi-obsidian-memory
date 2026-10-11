import type { IndexWriteResult, SearchIndex } from "./types.ts"

export function closeIndex(index: SearchIndex): IndexWriteResult {
  return index.close()
}

import type { FolderIndexState, FolderIndexStatesResult, IndexWriteResult, SearchIndex } from "./types.ts"

export function readFolderIndexStates(index: SearchIndex): FolderIndexStatesResult {
  return index.folderIndexes()
}

export function recordFolderIndexStates(
  index: SearchIndex,
  states: FolderIndexState[],
  keepFolders: string[],
): IndexWriteResult {
  return index.recordFolderIndexes(states, keepFolders)
}

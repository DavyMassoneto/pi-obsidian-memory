import type { CatalogChanges, VectorReplacement } from "#src/domain"
import { acquireIndexLock } from "./index-lock.ts"
import type {
  CatalogQuery,
  CatalogSearchResult,
  FolderIndexState,
  FolderIndexStatesResult,
  HeldIndex,
  IndexEntry,
  IndexWriteResult,
  InventoryResult,
  LockedWork,
  SearchIndex,
  SearchIndexRefusal,
  SearchOptions,
  SearchResult,
  VectorCacheResult,
  VectorCoverageResult,
  VectorUpdate,
} from "./types.ts"

export class LockedSearchIndex implements HeldIndex {
  readonly #inner: SearchIndex
  readonly #path: string

  constructor(inner: SearchIndex, path: string) {
    this.#inner = inner
    this.#path = path
  }

  put(entry: IndexEntry): IndexWriteResult {
    return this.#locked(() => this.#inner.put(entry))
  }

  remove(id: string): IndexWriteResult {
    return this.#locked(() => this.#inner.remove(id))
  }

  apply(changes: CatalogChanges): IndexWriteResult {
    return this.#locked(() => this.#inner.apply(changes))
  }

  replaceVectors(request: VectorReplacement): IndexWriteResult {
    return this.#locked(() => this.#inner.replaceVectors(request))
  }

  updateVectors(request: VectorUpdate): IndexWriteResult {
    return this.#locked(() => this.#inner.updateVectors(request))
  }

  recordFolderIndexes(states: FolderIndexState[], keepFolders: string[]): IndexWriteResult {
    return this.#locked(() => this.#inner.recordFolderIndexes(states, keepFolders))
  }

  vectorCoverage(): VectorCoverageResult {
    return this.#locked(() => this.#inner.vectorCoverage())
  }

  folderIndexes(): FolderIndexStatesResult {
    return this.#locked(() => this.#inner.folderIndexes())
  }

  inventory(): InventoryResult {
    return this.#locked(() => this.#inner.inventory())
  }

  vectors(): VectorCacheResult {
    return this.#locked(() => this.#inner.vectors())
  }

  searchCatalog(request: CatalogQuery): CatalogSearchResult {
    return this.#locked(() => this.#inner.searchCatalog(request))
  }

  search(query: string, options: SearchOptions): SearchResult {
    return this.#locked(() => this.#inner.search(query, options))
  }

  inventoryHeld(): InventoryResult {
    return this.#inner.inventory()
  }

  vectorsHeld(): VectorCacheResult {
    return this.#inner.vectors()
  }

  close(): IndexWriteResult {
    return this.#inner.close()
  }

  #locked<Result>(work: LockedWork<Result>): Result | SearchIndexRefusal {
    const lock = acquireIndexLock(this.#path)
    if (!lock.succeeded) return lock
    try {
      return work()
    } finally {
      lock.output.release()
    }
  }
}

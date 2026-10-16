import type { DatabaseSync } from "node:sqlite"

import type { CatalogChanges, VectorReplacement } from "#src/domain"
import { readCatalogHits } from "./catalog-query.ts"
import { prepareCatalogStatements } from "./catalog-statements.ts"
import { closeFailedIndex } from "./cleanup.ts"
import { prepareFolderIndexStatements } from "./folder-index-statements.ts"
import { readStoredFolderIndexes, writeFolderIndexStates } from "./folder-index-storage.ts"
import { readInventory } from "./inventory.ts"
import { putLegacyEntry, removeLegacyEntry } from "./legacy.ts"
import { readSearchHits } from "./query.ts"
import { writeCatalog } from "./reconcile.ts"
import { closedIndex, indexFailure } from "./refusals.ts"
import { prepareStatements } from "./statements.ts"
import type {
  CatalogQuery,
  CatalogSearchResult,
  FolderIndexState,
  FolderIndexStatesResult,
  IndexEntry,
  IndexWork,
  IndexWriteResult,
  InventoryResult,
  SearchIndex,
  SearchIndexRefusal,
  SearchOptions,
  SearchResult,
  VectorCacheResult,
  VectorCoverageResult,
  VectorUpdate,
} from "./types.ts"
import { prepareVectorStatements } from "./vector-statements.ts"
import { readVectorCoverage, readVectors, updateVectors, writeVectors } from "./vector-storage.ts"

export class SqliteSearchIndex implements SearchIndex {
  readonly #database: DatabaseSync
  readonly #statements: ReturnType<typeof prepareStatements>
  readonly #catalog: ReturnType<typeof prepareCatalogStatements>
  readonly #vectors: ReturnType<typeof prepareVectorStatements>
  readonly #folderIndexes: ReturnType<typeof prepareFolderIndexStatements>
  #usable = true

  constructor(database: DatabaseSync) {
    this.#database = database
    this.#statements = prepareStatements(database)
    this.#catalog = prepareCatalogStatements(database)
    this.#vectors = prepareVectorStatements(database)
    this.#folderIndexes = prepareFolderIndexStatements(database)
  }

  put(entry: IndexEntry): IndexWriteResult {
    return this.#write(() => putLegacyEntry(this.#statements, this.#catalog, entry))
  }

  remove(id: string): IndexWriteResult {
    return this.#write(() => removeLegacyEntry(this.#statements, this.#catalog, id))
  }

  apply(changes: CatalogChanges): IndexWriteResult {
    return this.#write(() => writeCatalog(this.#catalog, changes))
  }

  replaceVectors(request: VectorReplacement): IndexWriteResult {
    return this.#write(() => writeVectors(this.#vectors, this.#catalog, request))
  }

  updateVectors(request: VectorUpdate): IndexWriteResult {
    return this.#write(() => updateVectors(this.#vectors, this.#catalog, request))
  }

  vectorCoverage(): VectorCoverageResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      this.#database.exec("BEGIN")
      const result = readVectorCoverage(this.#vectors)
      this.#database.exec("COMMIT")
      return result
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return this.#rollBack(indexFailure(error))
    }
  }

  recordFolderIndexes(states: FolderIndexState[], keepFolders: string[]): IndexWriteResult {
    return this.#write(() => writeFolderIndexStates(this.#folderIndexes, states, keepFolders))
  }

  folderIndexes(): FolderIndexStatesResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      this.#database.exec("BEGIN")
      const result = readStoredFolderIndexes(this.#folderIndexes)
      this.#database.exec("COMMIT")
      return result
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return this.#rollBack(indexFailure(error))
    }
  }

  inventory(): InventoryResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      this.#database.exec("BEGIN")
      const result = readInventory(this.#catalog)
      this.#database.exec("COMMIT")
      return result
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return this.#rollBack(indexFailure(error))
    }
  }

  vectors(): VectorCacheResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      this.#database.exec("BEGIN")
      const result = readVectors(this.#vectors)
      this.#database.exec("COMMIT")
      return result
    } catch (error) {
      if (!(error instanceof Error)) throw error
      if (error instanceof SyntaxError) {
        return this.#rollBack({ succeeded: false, reason: "corrupted", problems: ["invalid cached vector JSON"] })
      }
      return this.#rollBack(indexFailure(error))
    }
  }

  searchCatalog(request: CatalogQuery): CatalogSearchResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      return readCatalogHits(this.#catalog.search, request)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return indexFailure(error)
    }
  }

  search(query: string, options: SearchOptions): SearchResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      return readSearchHits(this.#statements.search, query, options)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return indexFailure(error)
    }
  }

  close(): IndexWriteResult {
    if (!this.#database.isOpen) return { succeeded: true }

    try {
      this.#database.close()
      return { succeeded: true }
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return indexFailure(error)
    }
  }

  #write(work: IndexWork): IndexWriteResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()

    try {
      this.#database.exec("BEGIN IMMEDIATE")
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return indexFailure(error)
    }

    return this.#commit(work)
  }

  #commit(work: IndexWork): IndexWriteResult {
    try {
      const result = work()
      if (!result.succeeded) return this.#rollBack(result)

      this.#database.exec("COMMIT")
      return result
    } catch (error) {
      if (!(error instanceof Error)) throw error
      return this.#rollBack(indexFailure(error))
    }
  }

  #rollBack(failure: SearchIndexRefusal): SearchIndexRefusal {
    if (!this.#database.isTransaction) return failure

    try {
      this.#database.exec("ROLLBACK")
    } catch (error) {
      if (!(error instanceof Error)) throw error
      this.#usable = false
      failure.problems.push(`write rollback failed: ${error.message}`)
      return closeFailedIndex(this.#database, failure)
    }
    return failure
  }
}

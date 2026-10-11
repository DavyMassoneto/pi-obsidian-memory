import type { DatabaseSync } from "node:sqlite"

import { Value } from "typebox/value"

import { closeFailedIndex } from "./cleanup.ts"
import { readSearchHits } from "./query.ts"
import { closedIndex, indexFailure } from "./refusals.ts"
import { IndexEntrySchema } from "./schemas.ts"
import { prepareStatements } from "./statements.ts"
import type {
  IndexEntry,
  IndexWork,
  IndexWriteResult,
  SearchIndex,
  SearchIndexRefusal,
  SearchOptions,
  SearchResult,
} from "./types.ts"

export class SqliteSearchIndex implements SearchIndex {
  readonly #database: DatabaseSync
  readonly #statements: ReturnType<typeof prepareStatements>
  #usable = true

  constructor(database: DatabaseSync) {
    this.#database = database
    this.#statements = prepareStatements(database)
  }

  put(entry: IndexEntry): IndexWriteResult {
    if (!this.#usable || !this.#database.isOpen) return closedIndex()
    if (!Value.Check(IndexEntrySchema, entry) || !Number.isFinite(entry.modifiedMs)) {
      return { succeeded: false, reason: "invalid", problems: ["the entry does not match the index schema"] }
    }

    return this.#write(() => {
      this.#statements.put.run({ ...entry, dontForget: Number(entry.dontForget), archived: Number(entry.archived) })
    })
  }

  remove(id: string): IndexWriteResult {
    return this.#write(() => {
      this.#statements.remove.run({ id })
    })
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
      work()
      this.#database.exec("COMMIT")
      return { succeeded: true }
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

import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { closeFailedIndex } from "./cleanup.ts"
import { INDEX_FILE_EXTENSION, INDEX_FILE_NAME_LENGTH } from "./constants.ts"
import { indexFailure } from "./refusals.ts"
import { initializeSchema } from "./schema.ts"
import { SqliteSearchIndex } from "./storage.ts"
import type { OpenIndexResult } from "./types.ts"

export function openIndex(path: string): OpenIndexResult {
  try {
    mkdirSync(dirname(path), { recursive: true })
    return initializeIndex(new DatabaseSync(path))
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return indexFailure(error)
  }
}

function initializeIndex(database: DatabaseSync): OpenIndexResult {
  try {
    const schema = initializeSchema(database)
    if (!schema.succeeded) return closeFailedIndex(database, schema)

    return { succeeded: true, output: new SqliteSearchIndex(database), rebuilt: schema.output }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return closeFailedIndex(database, indexFailure(error))
  }
}

export function indexFileFor(indexFolder: string, vaultPath: string): string {
  const vaultKey = vaultPath.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()
  const name = createHash("sha256").update(vaultKey).digest("hex").slice(0, INDEX_FILE_NAME_LENGTH)

  return join(indexFolder, `${name}${INDEX_FILE_EXTENSION}`)
}

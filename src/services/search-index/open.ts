import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { INDEX_FILE_EXTENSION, INDEX_FILE_NAME_LENGTH } from "./constants.ts"
import type { SearchIndex } from "./types.ts"

export function openIndex(path: string): SearchIndex {
  mkdirSync(dirname(path), { recursive: true })

  const index = new DatabaseSync(path)
  index.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folder TEXT NOT NULL,
      statement TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      dont_forget INTEGER NOT NULL,
      archived INTEGER NOT NULL,
      size INTEGER NOT NULL,
      modified_ms REAL NOT NULL,
      hash TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      id UNINDEXED,
      statement,
      body,
      tokenize = 'porter unicode61'
    );
  `)

  return index
}

export function indexFileFor(indexFolder: string, vaultPath: string): string {
  const vaultKey = vaultPath.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()
  const name = createHash("sha256").update(vaultKey).digest("hex").slice(0, INDEX_FILE_NAME_LENGTH)

  return join(indexFolder, `${name}${INDEX_FILE_EXTENSION}`)
}

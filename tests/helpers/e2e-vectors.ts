import { existsSync } from "node:fs"
import { realpath } from "node:fs/promises"
import { DatabaseSync } from "node:sqlite"
import { pathToFileURL } from "node:url"

import Type from "typebox"
import { Value } from "typebox/value"

import { localEmbeddingPolicy } from "#src/domain"
import { memoryIndexPath } from "#src/pi"
import { indexFileFor, openIndex, readVectorCache, readVectorCoverage } from "#src/services"
import type { E2eWorld } from "./e2e-world.ts"

const StoredChunkSchema = Type.Object({
  rowid: Type.Number(),
  content_fingerprint: Type.String(),
  vector: Type.String(),
})

const SqliteErrorSchema = Type.Object({ errcode: Type.Number() })
const SQLITE_BUSY = 5
const SQLITE_LOCKED = 6
const SQLITE_CORRUPT = 11
const WRITER_CONFLICTS = [SQLITE_BUSY, SQLITE_LOCKED, SQLITE_CORRUPT]
const PRIMARY_CODE_MASK = 0xff
const CountSchema = Type.Object({ total: Type.Number() })

export interface StoredChunk {
  rowid: number
  contentFingerprint: string
  vector: string
}

export async function globalIndexFile(world: Pick<E2eWorld, "folders">): Promise<string> {
  return indexFileFor(memoryIndexPath(world.folders.agentDir), await realpath(world.folders.globalVault))
}

export async function vectorsOnDisk(world: Pick<E2eWorld, "folders">) {
  const opened = openIndex(await globalIndexFile(world))
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    const coverage = readVectorCoverage(opened.output)
    const cache = readVectorCache(opened.output)
    if (!coverage.succeeded || !cache.succeeded) throw new Error("vectors unavailable")
    return { coverage: coverage.output, chunks: cache.output.chunks.length, generation: cache.output.generation }
  } finally {
    opened.output.close()
  }
}

export async function storedChunkCountWhileRunning(world: Pick<E2eWorld, "folders">): Promise<number> {
  const path = await globalIndexFile(world)
  if (!existsSync(path)) return 0
  try {
    const database = new DatabaseSync(`${pathToFileURL(path).href}?immutable=1`, { readOnly: true })
    try {
      const row = database.prepare("SELECT COUNT(*) AS total FROM vector_chunks").get()
      if (!Value.Check(CountSchema, row)) return 0
      return row.total
    } finally {
      database.close()
    }
  } catch (error) {
    if (Value.Check(SqliteErrorSchema, error) && WRITER_CONFLICTS.includes(error.errcode & PRIMARY_CODE_MASK)) return 0
    throw error
  }
}

export async function markStoredVector(world: Pick<E2eWorld, "folders">, rowid: number): Promise<string> {
  const unit = 1 / Math.sqrt(localEmbeddingPolicy.dimensions)
  const marker = JSON.stringify(Array.from({ length: localEmbeddingPolicy.dimensions }, () => unit))
  const database = new DatabaseSync(await globalIndexFile(world))
  try {
    database.prepare("UPDATE vector_chunks SET vector = ? WHERE rowid = ?").run(marker, rowid)
  } finally {
    database.close()
  }
  return marker
}

export async function storedChunks(world: Pick<E2eWorld, "folders">): Promise<StoredChunk[]> {
  const path = await globalIndexFile(world)
  if (!existsSync(path)) return []
  const database = new DatabaseSync(path, { readOnly: true })
  try {
    const rows = database.prepare("SELECT rowid, content_fingerprint, vector FROM vector_chunks ORDER BY rowid").all()
    return rows.map((row) => {
      if (!Value.Check(StoredChunkSchema, row)) throw new Error("vector_chunks row has another shape")
      return { rowid: row.rowid, contentFingerprint: row.content_fingerprint, vector: row.vector }
    })
  } finally {
    database.close()
  }
}

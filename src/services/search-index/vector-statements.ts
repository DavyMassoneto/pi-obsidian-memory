import type { DatabaseSync } from "node:sqlite"

export function prepareVectorStatements(database: DatabaseSync) {
  return {
    generation: database.prepare("SELECT fingerprint, dimensions FROM vector_generation WHERE singleton = 1"),
    chunks: database.prepare(
      "SELECT content_fingerprint, chunk, vector FROM vector_chunks ORDER BY content_fingerprint, chunk",
    ),
    clearChunks: database.prepare("DELETE FROM vector_chunks"),
    clearGeneration: database.prepare("DELETE FROM vector_generation"),
    putGeneration: database.prepare("INSERT INTO vector_generation VALUES (1, ?, ?)"),
    putChunk: database.prepare("INSERT INTO vector_chunks VALUES (?, ?, ?)"),
    removeChunks: database.prepare("DELETE FROM vector_chunks WHERE content_fingerprint = ?"),
    currentContent: database.prepare(`SELECT DISTINCT content_fingerprint FROM notes
      WHERE id IS NOT NULL AND archived = 0 AND content_fingerprint IS NOT NULL`),
    embeddedContent: database.prepare("SELECT COUNT(DISTINCT content_fingerprint) AS embedded FROM vector_chunks"),
  }
}

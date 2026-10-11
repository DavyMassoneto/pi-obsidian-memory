import type { DatabaseSync } from "node:sqlite"

export function prepareStatements(database: DatabaseSync) {
  return {
    put: database.prepare(`
      INSERT INTO notes (id, folder, statement, body, type, dont_forget, archived, size, modified_ms, hash)
      VALUES (:id, :folder, :statement, :body, :type, :dontForget, :archived, :size, :modifiedMs, :hash)
      ON CONFLICT (id) DO UPDATE SET
        folder = excluded.folder, statement = excluded.statement, body = excluded.body,
        type = excluded.type, dont_forget = excluded.dont_forget, archived = excluded.archived,
        size = excluded.size, modified_ms = excluded.modified_ms, hash = excluded.hash
    `),
    remove: database.prepare("DELETE FROM notes WHERE id = :id"),
    search: database.prepare(`
      SELECT notes.id, notes.folder, notes.statement, notes.type,
        -bm25(notes_fts, :statementWeight, :bodyWeight) AS score
      FROM notes_fts
      JOIN notes ON notes.rowid = notes_fts.rowid
      WHERE notes_fts MATCH :match AND (notes.archived = 0 OR :includeArchived = 1)
      ORDER BY score DESC, notes.id
      LIMIT :limit
    `),
  }
}

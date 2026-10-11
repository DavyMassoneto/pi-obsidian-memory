import type { DatabaseSync } from "node:sqlite"

export function prepareStatements(database: DatabaseSync) {
  return {
    byId: database.prepare("SELECT path FROM notes WHERE id = ?"),
    move: database.prepare("UPDATE notes SET path = ? WHERE id = ?"),
    folder: database.prepare("UPDATE notes SET folder = ? WHERE path = ?"),
    remove: database.prepare("DELETE FROM notes WHERE id = :id"),
    search: database.prepare(`
      SELECT notes.id, notes.folder, notes.statement, notes.type,
        -bm25(notes_fts, :statementWeight, :bodyWeight) AS score
      FROM notes_fts
      JOIN notes ON notes.rowid = notes_fts.rowid
      WHERE notes_fts MATCH :match AND notes.id IS NOT NULL AND (notes.archived = 0 OR :includeArchived = 1)
      ORDER BY score DESC, notes.id
      LIMIT :limit
    `),
  }
}

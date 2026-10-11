import type { DatabaseSync } from "node:sqlite"

export function prepareCatalogStatements(database: DatabaseSync) {
  return {
    put: database.prepare(`
      INSERT INTO notes (path, id, folder, statement, body, type, dont_forget, archived,
        size, modified_ms, hash, content_fingerprint, validation_fingerprint, needs_fixing)
      VALUES (:path, :id, :folder, :statement, :body, :type, :dont_forget, :archived,
        :size, :modified_ms, :hash, :content_fingerprint, :validation_fingerprint, :needs_fixing)
      ON CONFLICT(path) DO UPDATE SET
        id = excluded.id, folder = excluded.folder, statement = excluded.statement, body = excluded.body,
        type = excluded.type, dont_forget = excluded.dont_forget, archived = excluded.archived,
        size = excluded.size, modified_ms = excluded.modified_ms, hash = excluded.hash,
        content_fingerprint = excluded.content_fingerprint, validation_fingerprint = excluded.validation_fingerprint,
        needs_fixing = excluded.needs_fixing
    `),
    remove: database.prepare("DELETE FROM notes WHERE path = ?"),
    stat: database.prepare("UPDATE notes SET size = ?, modified_ms = ? WHERE path = ?"),
    state: database.prepare("SELECT revision, population FROM catalog_state WHERE singleton = 1"),
    inventory: database.prepare(`SELECT path, id, type, statement, body, dont_forget, archived,
      size, modified_ms, hash, content_fingerprint, validation_fingerprint, needs_fixing FROM notes ORDER BY path`),
    advance: database.prepare("UPDATE catalog_state SET revision = revision + 1, population = ? WHERE singleton = 1"),
    prune: database.prepare(`DELETE FROM vector_chunks WHERE content_fingerprint NOT IN
      (SELECT content_fingerprint FROM notes WHERE id IS NOT NULL AND archived = 0)`),
    search: database.prepare(`
      SELECT notes.path, notes.id, notes.type, notes.statement,
        notes.dont_forget, notes.needs_fixing, -bm25(notes_fts, :statementWeight, :bodyWeight) AS score
      FROM notes_fts JOIN notes ON notes.rowid = notes_fts.rowid
      WHERE notes_fts MATCH :match AND notes.archived = 0 AND notes.id IS NOT NULL
      ORDER BY score DESC, notes.path LIMIT :limit
    `),
  }
}

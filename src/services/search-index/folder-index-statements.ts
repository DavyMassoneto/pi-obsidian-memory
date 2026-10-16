import type { DatabaseSync } from "node:sqlite"

export function prepareFolderIndexStatements(database: DatabaseSync) {
  return {
    all: database.prepare(
      "SELECT folder, fingerprint, index_size, index_mtime_ms, index_ctime_ms, index_ino FROM folder_indexes ORDER BY folder",
    ),
    put: database.prepare(`
      INSERT INTO folder_indexes (folder, fingerprint, index_size, index_mtime_ms, index_ctime_ms, index_ino)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(folder) DO UPDATE SET fingerprint = excluded.fingerprint,
        index_size = excluded.index_size, index_mtime_ms = excluded.index_mtime_ms,
        index_ctime_ms = excluded.index_ctime_ms, index_ino = excluded.index_ino
    `),
    prune: database.prepare("DELETE FROM folder_indexes WHERE folder NOT IN (SELECT value FROM json_each(?))"),
  }
}

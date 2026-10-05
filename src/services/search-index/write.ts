import type { IndexEntry, IndexWork, SearchIndex } from "./types.ts"

export function putNote(index: SearchIndex, entry: IndexEntry): void {
  const { id, statement, body } = entry

  inTransaction(index, () => {
    index
      .prepare(`
        INSERT INTO notes (id, folder, statement, body, type, dont_forget, archived, size, modified_ms, hash)
        VALUES (:id, :folder, :statement, :body, :type, :dontForget, :archived, :size, :modifiedMs, :hash)
        ON CONFLICT (id) DO UPDATE SET
          folder = excluded.folder,
          statement = excluded.statement,
          body = excluded.body,
          type = excluded.type,
          dont_forget = excluded.dont_forget,
          archived = excluded.archived,
          size = excluded.size,
          modified_ms = excluded.modified_ms,
          hash = excluded.hash
      `)
      .run({ ...entry, dontForget: Number(entry.dontForget), archived: Number(entry.archived) })
    index.prepare("DELETE FROM notes_fts WHERE id = :id").run({ id })
    index
      .prepare("INSERT INTO notes_fts (id, statement, body) VALUES (:id, :statement, :body)")
      .run({ id, statement, body })
  })
}

export function removeNote(index: SearchIndex, id: string): void {
  inTransaction(index, () => {
    index.prepare("DELETE FROM notes WHERE id = :id").run({ id })
    index.prepare("DELETE FROM notes_fts WHERE id = :id").run({ id })
  })
}

function inTransaction(index: SearchIndex, work: IndexWork): void {
  index.exec("BEGIN")

  try {
    work()
    index.exec("COMMIT")
  } catch (error) {
    index.exec("ROLLBACK")
    throw error
  }
}

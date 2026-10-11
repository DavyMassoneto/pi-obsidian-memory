export const INDEX_FILE_EXTENSION = ".sqlite"

export const INDEX_FILE_NAME_LENGTH = 16

export const STATEMENT_WEIGHT = 2

export const BODY_WEIGHT = 1

export const WORD_PATTERN = /[\p{L}\p{N}]+/gu

export const INDEX_SCHEMA_VERSION = 1

export const SQLITE_PRIMARY_CODE_MASK = 0xff

export const SQLITE_ERROR = 1

export const SQLITE_CORRUPT = 11

export const SQLITE_NOTADB = 26

export const REBUILD_SCHEMA_SQL = `
  DROP TABLE IF EXISTS notes_fts;
  DROP TABLE IF EXISTS notes;
  CREATE TABLE notes (
    rowid INTEGER PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
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
  CREATE VIRTUAL TABLE notes_fts USING fts5(
    statement, body,
    content = 'notes', content_rowid = 'rowid',
    tokenize = 'porter unicode61'
  );
  CREATE TRIGGER notes_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, statement, body) VALUES (new.rowid, new.statement, new.body);
  END;
  CREATE TRIGGER notes_delete AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, statement, body)
      VALUES ('delete', old.rowid, old.statement, old.body);
  END;
  CREATE TRIGGER notes_update AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, statement, body)
      VALUES ('delete', old.rowid, old.statement, old.body);
    INSERT INTO notes_fts(rowid, statement, body) VALUES (new.rowid, new.statement, new.body);
  END;
  PRAGMA user_version = ${INDEX_SCHEMA_VERSION};
`

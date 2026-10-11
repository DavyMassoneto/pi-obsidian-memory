export const INDEX_FILE_EXTENSION = ".sqlite"

export const INDEX_FILE_NAME_LENGTH = 16

export const STATEMENT_WEIGHT = 2

export const BODY_WEIGHT = 1

export const WORD_PATTERN = /[\p{L}\p{N}]+/gu

export const INDEX_SCHEMA_VERSION = 2

export const SQLITE_PRIMARY_CODE_MASK = 0xff

export const SQLITE_ERROR = 1

export const SQLITE_CORRUPT = 11

export const SQLITE_NOTADB = 26

export const REBUILD_SCHEMA_SQL = `
  DROP TABLE IF EXISTS notes_fts;
  DROP TABLE IF EXISTS notes;
  DROP TABLE IF EXISTS catalog_state;
  DROP TABLE IF EXISTS vector_chunks;
  DROP TABLE IF EXISTS vector_generation;
  CREATE TABLE catalog_state (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    revision INTEGER NOT NULL,
    population TEXT NOT NULL
  );
  INSERT INTO catalog_state VALUES (1, 0, 'needs-population');
  CREATE TABLE vector_generation (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    fingerprint TEXT NOT NULL,
    dimensions INTEGER NOT NULL
  );
  CREATE TABLE vector_chunks (
    content_fingerprint TEXT NOT NULL,
    chunk INTEGER NOT NULL,
    vector TEXT NOT NULL,
    PRIMARY KEY(content_fingerprint, chunk)
  );
  CREATE TABLE notes (
    rowid INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    id TEXT,
    folder TEXT NOT NULL,
    statement TEXT,
    body TEXT,
    type TEXT,
    dont_forget INTEGER,
    archived INTEGER,
    size INTEGER NOT NULL,
    modified_ms REAL NOT NULL,
    hash TEXT NOT NULL,
    content_fingerprint TEXT,
    validation_fingerprint TEXT NOT NULL,
    needs_fixing INTEGER NOT NULL
  );
  CREATE INDEX notes_id ON notes(id);
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
  CREATE TRIGGER notes_update AFTER UPDATE OF statement, body ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, statement, body)
      VALUES ('delete', old.rowid, old.statement, old.body);
    INSERT INTO notes_fts(rowid, statement, body) VALUES (new.rowid, new.statement, new.body);
  END;
  PRAGMA user_version = ${INDEX_SCHEMA_VERSION};
`

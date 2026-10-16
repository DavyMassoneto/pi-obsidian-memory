import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { onTestFinished } from "vitest"

import { type IndexEntry, openIndex, type SearchHit, type SearchIndex, type SearchResult } from "#src/services"
import { useTempFolder } from "./temp-folder.ts"

export async function useTempIndex(): Promise<SearchIndex> {
  const { index } = await useIndexFile()
  return index
}

export async function useIndexFile() {
  const folder = await useTempFolder()
  const path = join(folder, "vault.sqlite")
  const index = openedIndex(path)
  return { index, path }
}

export function openedIndex(path: string): SearchIndex {
  const result = openIndex(path)
  if (!result.succeeded) {
    throw new Error(`index setup failed: ${result.problems.join(", ")}`)
  }

  onTestFinished(() => {
    const closed = result.output.close()
    if (!closed.succeeded) {
      throw new Error(`index cleanup failed: ${closed.problems.join(", ")}`)
    }
  })
  return result.output
}

export function changeIndexFile(path: string, sql: string): void {
  const database = new DatabaseSync(path)
  try {
    database.exec(sql)
  } finally {
    database.close()
  }
}

export function holdIndexLock(path: string, mode: "read" | "write") {
  const database = new DatabaseSync(path)
  onTestFinished(() => {
    if (database.isOpen) {
      database.close()
    }
  })

  if (mode === "read") {
    database.exec("BEGIN; SELECT * FROM notes")
  } else {
    database.exec("BEGIN IMMEDIATE")
  }

  return () => database.close()
}

export function legacyIndexState(path: string) {
  const database = new DatabaseSync(path)
  try {
    const version = database.prepare("PRAGMA user_version").get()
    const note = database.prepare("SELECT id FROM notes").get()
    if (!version || typeof version.user_version !== "number" || !note || typeof note.id !== "string") {
      throw new Error("invalid legacy index fixture")
    }
    return { version: version.user_version, id: note.id }
  } finally {
    database.close()
  }
}

export function assertIndexConsistent(path: string): void {
  changeIndexFile(path, "INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
}

export function anEntry(): IndexEntry {
  return {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    folder: "tools/pnpm",
    statement: "Use pnpm, never npm",
    body: "Use pnpm for every install and script.",
    type: "rule",
    dontForget: false,
    archived: false,
    size: 120,
    modifiedMs: 1_790_000_000_000,
    hash: "a".repeat(64),
  }
}

export function entryWith(id: string, statement: string, body: string): IndexEntry {
  return { ...anEntry(), id, statement, body }
}

export function searchHits(result: SearchResult): SearchHit[] {
  if (!result.succeeded) {
    throw new Error(`search failed: ${result.problems.join(", ")}`)
  }
  return result.output
}

export function statementsOf(result: SearchResult): string[] {
  return searchHits(result).map((hit) => hit.statement)
}

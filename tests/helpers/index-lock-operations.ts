import { DatabaseSync } from "node:sqlite"

import type { SearchIndex } from "#src/services"
import type { IndexOperation } from "./index-lock-wire.ts"
import { catalogChanges, catalogEntry } from "./search-catalog.ts"
import { anEntry, entryWith, folderIndexState } from "./search-index.ts"
import { TEST_GENERATION } from "./search-vectors.ts"

export const WRITTEN_NOTE_ID = "01JABCDE7XKQ2M9V3RTN8WPZ60"

const CHILD_FOLDER_FINGERPRINT = "fingerprint-from-child"
const SEMANTIC_CHUNK = { contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }

export function prepareIndexContents(index: SearchIndex, content: "catalog" | "everything"): void {
  const applied = index.apply(catalogChanges([catalogEntry("tools/First.md")], 0))
  if (!applied.succeeded) throw new Error(`index setup failed: ${applied.problems.join(", ")}`)
  if (content === "catalog") return
  const steps = [
    index.replaceVectors({ expectedRevision: 1, generation: TEST_GENERATION, chunks: [SEMANTIC_CHUNK] }),
    index.recordFolderIndexes([folderIndexState("tools", "fingerprint-from-parent")], ["tools"]),
    index.put(anEntry()),
  ]
  for (const step of steps) {
    if (!step.succeeded) throw new Error(`index setup failed: ${step.problems.join(", ")}`)
  }
}

export function runIndexOperation(index: SearchIndex, operation: IndexOperation): string {
  return JSON.stringify(resultOf(index, operation))
}

function resultOf(index: SearchIndex, operation: IndexOperation) {
  switch (operation) {
    case "put":
      return index.put(entryWith(WRITTEN_NOTE_ID, "Prefer yarn", "Use yarn for installs."))
    case "replaceVectors":
      return index.replaceVectors({ expectedRevision: 1, generation: TEST_GENERATION, chunks: [SEMANTIC_CHUNK] })
    case "recordFolderIndexes":
      return index.recordFolderIndexes([folderIndexState("tools", CHILD_FOLDER_FINGERPRINT)], ["tools"])
    case "search":
      return index.search("pnpm", { includeArchived: false })
    case "searchCatalog":
      return index.searchCatalog({ query: "pnpm" })
    case "inventory":
    case "open":
      return index.inventory()
    case "vectors":
      return index.vectors()
    case "vectorCoverage":
      return index.vectorCoverage()
    case "folderIndexes":
      return index.folderIndexes()
  }
}

export function writeIsSaved(index: SearchIndex, operation: IndexOperation): boolean {
  if (operation === "put") {
    const found = index.search("yarn", { includeArchived: false })
    return found.succeeded && found.output.some((hit) => hit.id === WRITTEN_NOTE_ID)
  }
  if (operation === "replaceVectors") {
    const vectors = index.vectors()
    return vectors.succeeded && vectors.output.chunks.length === 1
  }
  const states = index.folderIndexes()
  return states.succeeded && states.output.some((state) => state.fingerprint === CHILD_FOLDER_FINGERPRINT)
}

export function storedNoteIds(path: string): string[] {
  const database = new DatabaseSync(path)
  try {
    return database
      .prepare("SELECT id FROM notes ORDER BY id")
      .all()
      .map((row) => String(row.id))
  } finally {
    database.close()
  }
}

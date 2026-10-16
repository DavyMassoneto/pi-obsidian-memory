import type { CatalogEntry, CatalogSnapshot } from "./types.ts"

export function dontForgetCandidates(snapshot: CatalogSnapshot): string[] {
  return snapshot.entries.filter(isLoadedEntry).map((entry) => entry.path)
}

function isLoadedEntry(entry: CatalogEntry): boolean {
  if (!entry.note) return false
  return entry.note.dontForget && !entry.note.archived
}

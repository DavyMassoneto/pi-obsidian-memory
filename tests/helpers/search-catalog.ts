import type { CatalogChanges, CatalogEntry, CatalogScan, CatalogSnapshot } from "#src/domain"

export function catalogEntry(path: string): CatalogEntry {
  return {
    path,
    stat: { size: 100, mtimeMs: 1000 },
    rawHash: "raw-one",
    contentFingerprint: "semantic-one",
    validationFingerprint: "limits-one",
    note: {
      id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
      type: "rule",
      statement: "Use pnpm",
      body: "Install packages with pnpm.",
      dontForget: true,
      archived: false,
    },
    needsFixing: false,
  }
}

export function catalogChanges(upserts: CatalogEntry[], expectedRevision: number): CatalogChanges {
  return { expectedRevision, upserts, deletes: [], statUpdates: [], population: "ready" }
}

export function catalogSnapshot(entries: CatalogEntry[]): CatalogSnapshot {
  return { entries, population: "ready", revision: 1 }
}

export function catalogScan(entries: CatalogEntry[]): CatalogScan {
  return {
    entries,
    observedPaths: entries.map((entry) => entry.path),
    completeDirectories: ["", "tools"],
    failedPaths: [],
    untraversedAliasDirectories: [],
    excludedAliasFiles: [],
    validationFingerprint: "limits-one",
    complete: true,
  }
}

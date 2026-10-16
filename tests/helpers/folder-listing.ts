import {
  type FolderListingFingerprint,
  folderListingFingerprints,
  type VaultAlias,
  type VaultCatalogEntry,
  type VaultCatalogFailure,
  type VaultEntryKind,
  type VaultEnumeration,
  type VaultFileStat,
} from "#src/domain"

export function aListedNote(path: string, size: number, mtimeMs: number): VaultCatalogEntry {
  return { path, kind: "note", archived: false, stat: { size, mtimeMs, ctimeMs: 1, device: 1, inode: 1 } }
}

export function aListedIndex(path: string, size: number, mtimeMs: number): VaultCatalogEntry {
  return { path, kind: "index", archived: false, stat: { size, mtimeMs, ctimeMs: 1, device: 1, inode: 1 } }
}

export function aListedFolder(path: string, mtimeMs: number): VaultCatalogEntry {
  return { path, kind: "folder", archived: false, stat: { size: 0, mtimeMs, ctimeMs: 1, device: 1, inode: 1 } }
}

export function aListedAlias(path: string, target: string): VaultAlias {
  return { path, target }
}

export function aListedFailure(path: string): VaultCatalogFailure {
  return { succeeded: false, problems: ["unreadable"], path, scope: "entry", reason: "unreadable" }
}

export function anEnumerationOf(entries: VaultCatalogEntry[], rest: Partial<VaultEnumeration>): VaultEnumeration {
  const folders = entries.filter((entry) => entry.kind === "folder").map((entry) => entry.path)
  return {
    entries,
    observedPaths: entries.map((entry) => entry.path),
    completeDirectories: ["", ...folders],
    failures: [],
    aliases: [],
    ...rest,
  }
}

export function fingerprintOf(fingerprints: FolderListingFingerprint[], folder: string): string | null {
  const found = fingerprints.find((item) => item.folder === folder)
  if (!found) throw new Error(`No fingerprint for folder "${folder}"`)
  return found.fingerprint
}

export function aListedFile(path: string, kind: VaultEntryKind, size: number, mtimeMs: number): VaultCatalogEntry {
  return { path, kind, archived: false, stat: { size, mtimeMs, ctimeMs: 1, device: 1, inode: 1 } }
}

export function toolsFingerprintWith(extra: VaultCatalogEntry[]): string | null {
  const entries = [aListedFolder("tools", 5), aListedNote("tools/Use pnpm.md", 10, 100), ...extra]
  return fingerprintOf(folderListingFingerprints(anEnumerationOf(entries, {}), "key"), "tools")
}

export function aListedNoteWith(path: string, stat: Partial<VaultFileStat>): VaultCatalogEntry {
  return {
    path,
    kind: "note",
    archived: false,
    stat: { size: 1, mtimeMs: 1, ctimeMs: 1, device: 1, inode: 1, ...stat },
  }
}

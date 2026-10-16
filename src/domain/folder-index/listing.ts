import { createHash } from "node:crypto"

import type { VaultCatalogEntry, VaultEnumeration } from "#src/domain/vault-catalog"
import type { FolderListingFingerprint } from "./types.ts"

export function folderListingFingerprints(
  enumeration: VaultEnumeration,
  renderKey: string,
): FolderListingFingerprint[] {
  const entries = new Map(enumeration.entries.map((entry) => [entry.path, entry]))
  return enumeration.completeDirectories.map((folder) => ({
    folder,
    fingerprint: fingerprintOf(enumeration, entries, folder, renderKey),
  }))
}

function fingerprintOf(
  enumeration: VaultEnumeration,
  entries: Map<string, VaultCatalogEntry>,
  folder: string,
  renderKey: string,
): string | null {
  if (enumeration.failures.some((failure) => failure.path === folder || parentOf(failure.path) === folder)) {
    return null
  }

  const children: string[] = []

  for (const entry of enumeration.entries) {
    if (parentOf(entry.path) !== folder) continue
    if (entry.kind === "folder") children.push(JSON.stringify(["folder", nameOf(entry.path)]))
    if (entry.kind === "note") children.push(JSON.stringify(["file", nameOf(entry.path), ...statOf(entry)]))
  }

  for (const alias of enumeration.aliases) {
    if (parentOf(alias.path) !== folder) continue
    const target = entries.get(alias.target)
    if (!target || nameOf(alias.path).toLowerCase() === "index.md") return null
    children.push(JSON.stringify(["alias", nameOf(alias.path), alias.target, ...statOf(target)]))
  }

  return createHash("sha256")
    .update(JSON.stringify([renderKey, children.sort()]))
    .digest("hex")
}

function parentOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0))
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1)
}

function statOf(entry: VaultCatalogEntry): number[] {
  const { size, mtimeMs, ctimeMs, device, inode } = entry.stat
  return [size, mtimeMs, ctimeMs, device, inode]
}

import type { InspectedVaultFile, VaultCatalogEntry, VaultEntryKind, VaultExportFile } from "#src/domain"
import { anInspectedFile, aVaultCatalogEntry } from "./vault-catalog.ts"

export function inspectedAt(path: string, text: string, archived: boolean): InspectedVaultFile {
  return { ...anInspectedFile(text, archived), path, canonicalPath: path }
}

export function catalogEntryAt(
  path: string,
  kind: Exclude<VaultEntryKind, "folder">,
  archived: boolean,
): VaultCatalogEntry {
  return { ...aVaultCatalogEntry(1, 1), path, kind, archived }
}

export function exportFileAt(path: string, text: string): VaultExportFile {
  return { path, bytes: new TextEncoder().encode(text), rawHash: `hash-${path}`, stat: aVaultCatalogEntry(1, 1).stat }
}

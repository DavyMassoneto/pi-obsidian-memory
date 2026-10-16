import type { VaultCatalogFailure, VaultExportFile } from "#src/domain"
import type { Failed, Succeeded } from "#src/shared"

export interface FolderIndexRequest {
  folder: string
}

export interface FolderIndex extends VaultExportFile {
  text: string
  canonicalPath: string
}

export interface AmbiguousFolderIndex extends Failed {
  reason: "ambiguous-index"
  path: string
}

export type FolderIndexResult = Succeeded<FolderIndex> | VaultCatalogFailure | AmbiguousFolderIndex
export type FolderIndexPathResult = Succeeded<string> | VaultCatalogFailure | AmbiguousFolderIndex

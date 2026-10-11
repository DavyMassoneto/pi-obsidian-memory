import type { VaultCatalogFailure, VaultExportFile } from "#/domain"
import type { Failed, Succeeded } from "#/shared"

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

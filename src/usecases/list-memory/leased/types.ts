import type { AmbiguousFolderIndex, FolderIndex, MemoryScope, NoProjectRefusal, VaultCatalogFailure } from "#/services"
import type { Succeeded } from "#/shared"
import type { MemoryResolutionRefusal } from "#/usecases/resolve-memory"

export interface FolderRead extends FolderIndex {
  kind: "folder"
  vault: MemoryScope
}

export type ListMemoryResult =
  | Succeeded<FolderRead>
  | MemoryResolutionRefusal
  | NoProjectRefusal
  | VaultCatalogFailure
  | AmbiguousFolderIndex

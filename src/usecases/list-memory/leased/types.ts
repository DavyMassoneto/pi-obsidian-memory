import type {
  AmbiguousFolderIndex,
  FolderIndex,
  MemoryScope,
  NoProjectRefusal,
  VaultCatalogFailure,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

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

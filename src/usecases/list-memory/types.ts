import type { MemoryScope } from "#src/services"

export type { FolderRead, ListMemoryResult } from "#src/usecases/list-memory/leased"

export interface ListMemoryRequest {
  vault: MemoryScope
  folder: string
}

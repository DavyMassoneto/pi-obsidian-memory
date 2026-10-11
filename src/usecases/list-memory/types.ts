import type { MemoryScope } from "#/services"

export type { FolderRead, ListMemoryResult } from "#/usecases/list-memory/leased"

export interface ListMemoryRequest {
  vault: MemoryScope
  folder: string
}

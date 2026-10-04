import type { ConfigRefusal } from "#/services/config"
import type { MemoryDraft, MemoryScope, NoProjectRefusal } from "#/services/memory"
import type { StoredNote, VaultRefusal } from "#/services/vault"
import type { Failed, Succeeded } from "#/shared/result"

export interface AddMemoryRequest {
  scope: MemoryScope
  folder: string
  draft: MemoryDraft
}

export interface MemoryContext {
  configPath: string
  workingFolder: string
}

export interface AddedMemory {
  vaultName: string
  folder: string
  stored: StoredNote
}

export interface ExistingMemoryRefusal extends Failed {
  reason: "exists"
  existing: StoredNote
}

export type AddMemoryResult =
  | Succeeded<AddedMemory>
  | ConfigRefusal
  | NoProjectRefusal
  | VaultRefusal
  | ExistingMemoryRefusal

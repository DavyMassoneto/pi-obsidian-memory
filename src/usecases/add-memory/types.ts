import type { Static } from "typebox"

import type { ConfigRefusal } from "#/services/config"
import type { NoProjectRefusal } from "#/services/memory"
import type { StoredNote, VaultRefusal } from "#/services/vault"
import type { Failed, Succeeded } from "#/shared/result"
import type { AddMemoryRequestSchema } from "./schemas.ts"

export type AddMemoryRequest = Static<typeof AddMemoryRequestSchema>

export interface MemoryContext {
  configPath: string
  workingFolder: string
}

export interface AddedMemory {
  vaultName: string
  folder: string
  notePath: string
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

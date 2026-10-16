import type { Static } from "typebox"

import type { ConfigRefusal, CreateResult, NoProjectRefusal, StoredNote } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryOperationRefusal } from "#src/usecases/operation-context"
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
  maintenanceProblems: string[]
}

export interface UnregisteredProjectRefusal extends NoProjectRefusal {
  configPath: string
}

export interface ExistingMemoryRefusal extends Failed {
  reason: "exists"
  existing: StoredNote
}

export type AddMemoryResult =
  | Succeeded<AddedMemory>
  | ConfigRefusal
  | UnregisteredProjectRefusal
  | Extract<CreateResult, Failed>
  | ExistingMemoryRefusal
  | MemoryOperationRefusal

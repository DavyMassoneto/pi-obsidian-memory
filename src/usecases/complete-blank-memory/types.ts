import type { Static } from "typebox"

import type {
  BlankCompletionRefusal,
  MemoryScope,
  NoProjectRefusal,
  UpdateRefusal,
  VaultCatalogFailure,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"
import type { CompleteBlankMemoryRequestSchema } from "./schemas.ts"

export type CompleteBlankMemoryRequest = Static<typeof CompleteBlankMemoryRequestSchema>

export interface CompletedBlank {
  vault: MemoryScope
  path: string
  maintenanceProblems: string[]
}

export type CompleteBlankMemoryResult =
  | Succeeded<CompletedBlank>
  | BlankCompletionRefusal
  | UpdateRefusal
  | VaultCatalogFailure
  | MemoryResolutionRefusal
  | NoProjectRefusal

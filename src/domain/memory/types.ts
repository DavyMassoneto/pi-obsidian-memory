import type { Static } from "typebox"

import type { Failed, Succeeded } from "#/shared"
import type { MemoryDraftSchema, MemoryScopeSchema } from "./schemas.ts"

export type MemoryScope = Static<typeof MemoryScopeSchema>

export type MemoryDraft = Static<typeof MemoryDraftSchema>

export interface VaultTarget {
  path: string
  name: string
}

export interface NoProjectRefusal extends Failed {
  reason: "no-project"
  workingFolder: string
}

export type TargetVaultResult = Succeeded<VaultTarget> | NoProjectRefusal

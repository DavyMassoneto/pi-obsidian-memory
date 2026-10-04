import type { NoteType } from "#/domain/note"
import type { Failed, Succeeded } from "#/shared/result"

export type MemoryScope = "global" | "project"

export interface MemoryDraft {
  statement: string
  type: NoteType
  body: string
  dontForget: boolean
}

export interface VaultTarget {
  path: string
  name: string
}

export interface NoProjectRefusal extends Failed {
  reason: "no-project"
}

export type TargetVaultResult = Succeeded<VaultTarget> | NoProjectRefusal

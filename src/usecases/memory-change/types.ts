import type { NoProjectRefusal, Note, PartialRelocation } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal, ResolvedVault } from "#src/usecases/resolve-memory"
import type { DeliveredRead } from "#src/usecases/session"

export interface ReceiptedNote {
  read: DeliveredRead
  note: Note
  folder: string
}

export interface ReceiptRefusal extends Failed {
  reason: "not-read" | "stale-vault" | "needs-fixing" | "archived"
}

export type ReceiptResult = Succeeded<ReceiptedNote> | ReceiptRefusal

export interface PartialMemoryChange extends Failed {
  reason: "partial"
  published: string[]
  originalState: PartialRelocation["originalState"]
}

export interface LeasedChange {
  target: ResolvedVault
  context: MemoryOperationContext
  receipted: ReceiptedNote
}

export interface ChangeOutcomeFailure {
  succeeded: false
  reason: string
}

export interface ChangeOutcomeSuccess {
  succeeded: true
}

export type ChangeOutcome = ChangeOutcomeSuccess | ChangeOutcomeFailure

export type ApplyChange<Result extends ChangeOutcome> = (change: LeasedChange) => Promise<Result>

export type ChangeRefusal = MemoryResolutionRefusal | NoProjectRefusal | ReceiptRefusal

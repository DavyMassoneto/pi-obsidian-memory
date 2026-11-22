import type { LedgerObservation } from "#src/services"
import type { Succeeded } from "#src/shared"
import type {
  AppliedListener,
  AppliedWrite,
  CaptureFailure,
  CaptureRun,
  ExplicitSave,
} from "#src/usecases/capture-memory"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface ConsolidateSessionRequest {
  observations: LedgerObservation[]
  corrections: LedgerObservation[]
  correctionNotes: ExplicitSave[]
  journey: string
  saved: ExplicitSave[]
  owedNotes: ExplicitSave[]
  onApplied: AppliedListener
}

export type ConsolidationCapture = Pick<CaptureRun, "kind" | "material" | "explicitSaves" | "onApplied">

export interface ConsolidatedSession {
  applied: AppliedWrite[]
  notes: ExplicitSave[]
  journey: string
}

export type ConsolidateSessionResult = Succeeded<ConsolidatedSession> | MemoryResolutionRefusal | CaptureFailure

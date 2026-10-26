import type { LedgerObservation } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { AppliedWrite, CaptureFailure, ExplicitSave } from "#src/usecases/capture-memory"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface ConsolidateSessionRequest {
  observations: LedgerObservation[]
  journey: string
  saved: ExplicitSave[]
}

export interface ConsolidatedSession {
  applied: AppliedWrite[]
  journey: string
}

export type ConsolidateSessionResult = Succeeded<ConsolidatedSession> | MemoryResolutionRefusal | CaptureFailure

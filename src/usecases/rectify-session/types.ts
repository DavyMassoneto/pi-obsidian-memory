import type {
  AttributionCheck,
  ModelCallFailure,
  ObservationsRectified,
  RectifiedObservation,
  SessionRecord,
  UserWordsStepResult,
} from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface VerifyAttributionRequest {
  check: AttributionCheck
}

export interface RepairAttributionRequest {
  records: SessionRecord[]
  check: AttributionCheck
  origins: RectifiedObservation[]
}

export type ExtractUserWordsResult = UserWordsStepResult | MemoryResolutionRefusal

export type VerifyAttributionResult =
  | Succeeded<ObservationsRectified>
  | Failed
  | ModelCallFailure
  | MemoryResolutionRefusal

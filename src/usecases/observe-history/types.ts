import type { ObservationCommit, ObserveModelInput } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"

export type ObserveHistoryInput = ObserveModelInput
export type ObserveHistoryResult = Succeeded<ObservationCommit> | Failed

export type { ObservationCommit, SourceEntry } from "#src/services"

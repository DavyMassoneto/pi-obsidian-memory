import type { ChatModelReference, ObserverDraft, SourceEntry } from "#src/domain"
import type { Failed, Succeeded } from "#src/shared"

export interface ObserveModelInput {
  contextEntries?: SourceEntry[]
  entries: SourceEntry[]
  model: ChatModelReference
  signal: AbortSignal
}

export type ObserveModelResult = Succeeded<ObserverDraft[]> | Failed

export type { ObservationCommit, SourceEntry } from "#src/domain"

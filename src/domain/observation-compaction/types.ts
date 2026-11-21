import type { Observation, ObservationCommit, SourceEntry } from "#src/domain/observations"

export interface ObservationSummaryInput {
  observations: Observation[]
  memoryMap: string
}

export interface ObservationCompactionInput {
  sources: SourceEntry[]
  commits: ObservationCommit[]
  memoryMap: string
  tailTokens: number
}

export interface ObservationCompactionPlan {
  firstKeptEntryId: string
  summary: string
}

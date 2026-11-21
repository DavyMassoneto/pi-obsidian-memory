import type { Static } from "typebox"

import type { ObservationCommitSchema, StoredObservationSchema } from "./schemas.ts"

export interface SourceEntry {
  id: string
  parentId: string | null
  text: string
  tokenCount: number
  canStartKeptRange: boolean
}

export type Observation = Static<typeof StoredObservationSchema>
export type ObservationCommit = Static<typeof ObservationCommitSchema>

export interface ObservationPlannerSettings {
  chunkTokens: number
  chunkOverlapTokens: number
  maxSlices: number
}

export interface ObservationSlice {
  entries: SourceEntry[]
  contextEntries: SourceEntry[]
}

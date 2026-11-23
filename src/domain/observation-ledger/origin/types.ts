import type { Static } from "typebox"

import type {
  AttributionVerdictSchema,
  ConsolidationMetaSchema,
  NoteWrittenSchema,
  ObservationOriginSchema,
  ObservationsRectifiedSchema,
  RectifiedObservationSchema,
  RectifyFailedSchema,
  RepairSchema,
  UserPassageSchema,
  UserWordsSchema,
} from "./schemas.ts"

export type ObservationOrigin = Static<typeof ObservationOriginSchema>

export type ObservationsRectified = Static<typeof ObservationsRectifiedSchema>

export type RectifiedObservation = Static<typeof RectifiedObservationSchema>

export type AttributionVerdict = Static<typeof AttributionVerdictSchema>

export type Repair = Static<typeof RepairSchema>

export type ConsolidationMeta = Static<typeof ConsolidationMetaSchema>

export type NoteWritten = Static<typeof NoteWrittenSchema>

export type RectifyFailed = Static<typeof RectifyFailedSchema>

export type UserWords = Static<typeof UserWordsSchema>

export type UserPassage = Static<typeof UserPassageSchema>

export interface UserWordsCheck {
  entryId: string
  text: string
}

export interface UserWordsCompanion {
  type: "obsidian-memory-user-words"
  data: UserWords
}

export interface ConsolidationMetaCompanion {
  type: "obsidian-memory-consolidation"
  data: ConsolidationMeta
}

export interface NoteWrittenCompanion {
  type: "obsidian-memory-note-written"
  data: NoteWritten
}

export interface RectifyFailedCompanion {
  type: "obsidian-memory-rectify-failed"
  data: RectifyFailed
}

export type CycleCompanion =
  | UserWordsCompanion
  | ConsolidationMetaCompanion
  | NoteWrittenCompanion
  | RectifyFailedCompanion

export interface OriginMaterialItem {
  label: string
  text: string
}

export interface UserMessageText {
  id: string
  text: string
}

export interface MaterialSource {
  id: string
  role: "assistant" | "toolResult" | "bashExecution" | "custom-message" | "branch-summary"
  text: string
  truncated: boolean
}

export interface CheckedObservation {
  id: string
  content: string
}

export interface AttributionCheck {
  recordId: string
  fromId: string
  coversUpToId: string
  userEntryIds: string[]
  userMessages: UserMessageText[]
  materialSources: MaterialSource[]
  observations: CheckedObservation[]
}

export interface RepairCheck {
  check: AttributionCheck
  origins: RectifiedObservation[]
}

export type RectifiedOrigins = ReadonlyMap<string, RectifiedObservation>

export interface RectifiedRecord {
  kind: "rectified"
  id: string
  data: ObservationsRectified
}

export interface UserWordsRecord {
  kind: "user-words"
  id: string
  data: UserWords
}

export interface ConsolidationMetaRecord {
  kind: "consolidation-meta"
  id: string
  data: ConsolidationMeta
}

export interface NoteWrittenRecord {
  kind: "note-written"
  id: string
  data: NoteWritten
}

export interface RectifyFailedRecord {
  kind: "rectify-failed"
  id: string
  data: RectifyFailed
}

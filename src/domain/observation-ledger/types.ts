import type { Static } from "typebox"

import type { ReadObservation } from "#src/domain/memory-agent"
import type { LedgerObservationSchema, ObservationsRecordedSchema } from "./schemas.ts"

export type LedgerObservation = Static<typeof LedgerObservationSchema>

export type ObservationsRecorded = Static<typeof ObservationsRecordedSchema>

export type SavedNote = Pick<ReadObservation, "vault" | "path">

export interface RecordPart {
  kind: "text" | "toolCall" | "omitted"
  text: string
}

export interface MessageRecord {
  kind: "message"
  id: string
  role: "user" | "assistant" | "toolResult" | "bashExecution"
  toolName: string | null
  localTime: string | null
  tokens: number
  parts: RecordPart[]
  saved: SavedNote | null
}

export interface CustomMessageRecord {
  kind: "custom-message"
  id: string
  customType: string
  localTime: string | null
  tokens: number
  text: string
}

export interface BranchSummaryRecord {
  kind: "branch-summary"
  id: string
  localTime: string | null
  tokens: number
  text: string
}

export interface ObservationsRecord {
  kind: "observations"
  id: string
  data: ObservationsRecorded
}

export interface CompactionRecord {
  kind: "compaction"
  id: string
  firstKeptEntryId: string
}

export interface OtherRecord {
  kind: "other"
  id: string
}

export type SourceRecord = MessageRecord | CustomMessageRecord | BranchSummaryRecord

export type SessionRecord = SourceRecord | ObservationsRecord | CompactionRecord | OtherRecord

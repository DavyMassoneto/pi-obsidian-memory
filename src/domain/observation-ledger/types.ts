import type { Static } from "typebox"

import type { ReadObservation } from "#src/domain/memory-agent"
import type { LedgerObservationSchema, ObservationsRecordedSchema, ObserverDraftSchema } from "./schemas.ts"

export type LedgerObservation = Static<typeof LedgerObservationSchema>

export type ObservationsRecorded = Static<typeof ObservationsRecordedSchema>

export type ObserverDraft = Static<typeof ObserverDraftSchema>

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

export interface CoveredRange {
  from: number
  to: number
  observations: LedgerObservation[]
}

export interface Ledger {
  ranges: CoveredRange[]
  used: ReadonlySet<string>
  consolidated: ReadonlySet<string>
  journey: string
}

export interface ChunkRange {
  fromId: string
  coversUpToId: string
}

export interface ChunkSlice extends ChunkRange {
  tokens: number
}

export interface CutoffSnap {
  firstKeptEntryId: string
  firstKeptIndex: number
  tail: number
}

export interface CompactionDueRequest {
  contextTokens: number | null
  records: SessionRecord[]
  atContextTokens: number
  tailTokens: number
  chunkTokens: number
}

export interface FailedChunk {
  fromId: string
  failedAtMs: number
}

export interface IndexRange {
  from: number
  to: number
}

export interface Span {
  from: number
  to: number
  closed: boolean
}

export interface ChunkPlanRequest {
  records: SessionRecord[]
  ledger: Ledger
  inFlight: ChunkRange[]
  failed: FailedChunk[]
  attempted: string[]
  chunkTokens: number
  concurrency: number
  nowMs: number
  until: string | null
}

export type SourceRecord = MessageRecord | CustomMessageRecord | BranchSummaryRecord

export type SessionRecord = SourceRecord | ObservationsRecord | CompactionRecord | OtherRecord

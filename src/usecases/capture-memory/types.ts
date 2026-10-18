import type {
  CaptureAction,
  CaptureInput,
  CaptureObservation,
  ChatModelReference,
  CompletionPort,
  MemoryScope,
  ReadObservation,
  TranscriptMessage,
} from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { ArchiveMemoryResult } from "#src/usecases/archive-memory"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"
import type { SucceedMemoryResult } from "#src/usecases/succeed-memory"
import type { UpdateMemoryResult } from "#src/usecases/update-memory"

export type { CompletionPort, CompletionRequest, TranscriptMessage } from "#src/services"

export interface ExplicitSave {
  vault: MemoryScope
  path: string
}

export interface UnreadableNote {
  kind: "unreadable"
  existence: "gone" | "present" | "unknown"
  detail: string
}

export type CaptureTrigger = "after-each-turn" | "on-compaction" | "at-session-end"

export interface CaptureRun {
  trigger: CaptureTrigger
  messages: TranscriptMessage[]
  explicitSaves: ExplicitSave[]
}

export interface AppliedWrite {
  operation: "add" | "update" | "archive" | "succeed"
  status: "applied" | "conflict" | "refused"
  vault: MemoryScope
  path: string
  detail: string
}

export interface CaptureReport {
  reviewed: boolean
  applied: AppliedWrite[]
}

export interface CaptureFailure extends Failed {
  reason: "model-failed" | "interrupted"
  report: CaptureReport
}

export type CaptureMemoryResult = Succeeded<CaptureReport> | MemoryResolutionRefusal | CaptureFailure

export interface NonWriteActions {
  action: "search" | "get" | "list" | "finish"
}

export type WriteAction = Exclude<CaptureAction, NonWriteActions>

export type FinishedWrite = UpdateMemoryResult | ArchiveMemoryResult | SucceedMemoryResult

export interface CaptureBase {
  context: CaptureInput["context"]
  explicitSaves: ReadObservation[]
  limits: CaptureInput["limits"]
  model: ChatModelReference
  signal: AbortSignal
}

export interface ReviewTools {
  context: MemoryOperationContext
  complete: CompletionPort
  report: CaptureReport
}

export type NextStep = "continue" | "stop"

export interface ListingDiscriminant {
  kind: "listing"
}

export type ListedNote = Extract<CaptureObservation, ListingDiscriminant>["notes"][number]

export interface ChangeDiscriminant {
  action: "update" | "archive" | "succeed"
}

export type ChangeAction = Extract<WriteAction, ChangeDiscriminant>

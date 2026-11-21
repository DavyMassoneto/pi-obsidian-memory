import type {
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  SessionCompactEvent,
  SessionEntry,
} from "@earendil-works/pi-coding-agent"

import type { CompletionFactory } from "#src/pi/capture"
import type { ChatModelSource, MemoryPaths, MemoryPiContext, RegistryMessage } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type { ObservationCommit, ObservationSlice } from "#src/usecases"

export type ObservationCompactTrigger = Pick<SessionBeforeCompactEvent, "preparation" | "signal">

export type ObservationCompactHandler = (
  event: ObservationCompactTrigger,
  ctx: MemoryPiContext,
) => Promise<SessionBeforeCompactResult | undefined>

export type CompactionDoneEvent = Pick<SessionCompactEvent, "compactionEntry">

export type CompactionDoneHandler = (event: CompactionDoneEvent, ctx: MemoryPiContext) => Promise<void>

export interface ObservationSettling {
  settled(): Promise<void>
}

export interface ObservationCompactionDeps {
  observer: ObservationSettling
  paths: MemoryPaths
  sessions: MemorySessionKeeper
}

export type ObservationCommitWriter = (commit: ObservationCommit) => void
export type SourceContent = string | RegistryMessage["content"] | SourceUserMessage["content"]

export interface UserMessageDiscriminant {
  role: "user"
}

export type SourceUserMessage = Extract<SourceMessageEntry["message"], UserMessageDiscriminant>

export interface ObservationRuntimeDeps {
  completionOf: CompletionFactory
  writeCommit: ObservationCommitWriter
}

export interface ObservationRuntimeSettings {
  chunkTokens: number
  chunkOverlapTokens: number
  observerConcurrency: number
}

export interface ObservationJob {
  sourceIds: string[]
  controller: AbortController
  promise: Promise<void>
}

export interface ObservationDispatch {
  ctx: MemoryPiContext
  model: ChatModelSource
  settings: ObservationRuntimeSettings
  flush: boolean
  attemptedIds: string[]
}

export interface ObservationRun {
  ctx: MemoryPiContext
  model: ChatModelSource
  sessionId: string
  anchorId: string
  generation: number
  slice: ObservationSlice
  signal: AbortSignal
}

export interface SessionMessageDiscriminant {
  type: "message"
}

export type SourceMessageEntry = Extract<SessionEntry, SessionMessageDiscriminant>

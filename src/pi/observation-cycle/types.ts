import type {
  AgentEndEvent,
  AgentStartEvent,
  CompactionEntryDraft,
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  TurnEndEvent,
  TurnEndEventResult,
} from "@earendil-works/pi-coding-agent"

import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryPaths, MemoryPiContext, NotifyLevel } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type {
  CompletionPort,
  CycleCompanion,
  CycleSettings,
  Ledger,
  LedgerObservation,
  MemoryOperationContext,
  ObservationsConsolidated,
  ObservationsRecorded,
  ObservationsRectified,
  SessionRecord,
} from "#src/usecases"

export type TurnEndHandler = (event: TurnEndEvent, ctx: MemoryPiContext) => Promise<TurnEndEventResult | undefined>

export type AgentEndHandler = (event: AgentEndEvent, ctx: MemoryPiContext) => void

export type AgentStartHandler = (event: AgentStartEvent, ctx: MemoryPiContext) => Promise<void>

export type BeforeCompactHandler = (
  event: SessionBeforeCompactEvent,
  ctx: MemoryPiContext,
) => Promise<SessionBeforeCompactResult | undefined>

export type AppendObservations = (data: ObservationsRecorded) => void

export type AppendConsolidated = (data: ObservationsConsolidated) => void

export type AppendRectified = (data: ObservationsRectified) => void

export interface CompactionAttempt {
  afterId: string
  draft: CompactionEntryDraft
}

export type CompactionBuild = () => Promise<CompactionEntryDraft | null>

export type IdleRelease = () => void

export type NoticeTimer = ReturnType<typeof setTimeout>

export interface NoticeUi {
  notify(message: string, type?: NotifyLevel): void
}

export interface NoticeTarget {
  hasUI: boolean
  ui: NoticeUi
}

export type CancelSignal = () => AbortSignal

export type AfterVerified = (ctx: MemoryPiContext, settings: CycleSettings) => void

export type RectificationWork = (context: MemoryOperationContext, complete: CompletionPort) => Promise<string[]>

export interface RectificationJob {
  recordId: string | null
  work: RectificationWork
}

export type AppendCompanion = (record: CycleCompanion) => void

export interface Promotion {
  records: SessionRecord[]
  ledger: Ledger
  promoted: LedgerObservation[]
  corrections: LedgerObservation[]
}

export interface ObservationCycleDeps {
  paths: MemoryPaths
  sessions: MemorySessionKeeper
  completionOf: CompletionFactory
  appendObservations: AppendObservations
  appendConsolidated: AppendConsolidated
  appendRectified: AppendRectified
  appendCompanion: AppendCompanion
}

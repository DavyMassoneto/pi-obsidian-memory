import type {
  AgentStartEvent,
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent"

import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type {
  Ledger,
  LedgerObservation,
  ObservationsConsolidated,
  ObservationsRecorded,
  SessionRecord,
} from "#src/usecases"

export type TurnEndHandler = (event: TurnEndEvent, ctx: MemoryPiContext) => Promise<void>

export type AgentStartHandler = (event: AgentStartEvent, ctx: MemoryPiContext) => Promise<void>

export type BeforeCompactHandler = (
  event: SessionBeforeCompactEvent,
  ctx: MemoryPiContext,
) => Promise<SessionBeforeCompactResult | undefined>

export type AppendObservations = (data: ObservationsRecorded) => void

export type AppendConsolidated = (data: ObservationsConsolidated) => void

export type SendResume = () => void

export type IdleRelease = () => void

export type CancelSignal = () => AbortSignal

export interface Promotion {
  records: SessionRecord[]
  ledger: Ledger
  promoted: LedgerObservation[]
}

export interface ObservationCycleDeps {
  paths: MemoryPaths
  sessions: MemorySessionKeeper
  completionOf: CompletionFactory
  appendObservations: AppendObservations
  appendConsolidated: AppendConsolidated
  sendResume: SendResume
}

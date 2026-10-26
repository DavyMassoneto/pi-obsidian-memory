import type { AgentStartEvent, SessionBeforeCompactEvent, TurnEndEvent } from "@earendil-works/pi-coding-agent"

import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type { ObservationsRecorded } from "#src/usecases"

export type TurnEndHandler = (event: TurnEndEvent, ctx: MemoryPiContext) => Promise<void>

export type AgentStartHandler = (event: AgentStartEvent, ctx: MemoryPiContext) => Promise<void>

export type CompactTrigger = Pick<SessionBeforeCompactEvent, "type" | "reason">

export type BeforeCompactHandler = (event: CompactTrigger, ctx: MemoryPiContext) => Promise<void>

export type AppendObservations = (data: ObservationsRecorded) => void

export interface ObservationCycleDeps {
  paths: MemoryPaths
  sessions: MemorySessionKeeper
  completionOf: CompletionFactory
  appendObservations: AppendObservations
}

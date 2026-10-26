import type { MessageEndEvent, SessionBeforeCompactEvent, TurnEndEvent } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type { ExplicitSave, TranscriptMessage } from "#src/usecases"
import type { CursorSchema } from "./schemas.ts"

export type CursorData = Static<typeof CursorSchema>

export interface ReviewableTranscript {
  messages: TranscriptMessage[]
  explicitSaves: ExplicitSave[]
  lastEntryId: string | null
}

export type CursorWriter = (data: CursorData) => void

export interface CaptureDeps {
  paths: MemoryPaths
  sessions: MemorySessionKeeper
  completionOf: CompletionFactory
  writeCursor: CursorWriter
}

export type CaptureKind = "review" | "flush"

export interface PendingCapture {
  ctx: MemoryPiContext
  kind: CaptureKind
}

export type MessageEndHandler = (event: MessageEndEvent, ctx: MemoryPiContext) => Promise<void>

export type TurnEndHandler = (event: TurnEndEvent, ctx: MemoryPiContext) => Promise<void>

export type CompactTrigger = Pick<SessionBeforeCompactEvent, "type" | "reason">

export type BeforeCompactHandler = (event: CompactTrigger, ctx: MemoryPiContext) => Promise<void>

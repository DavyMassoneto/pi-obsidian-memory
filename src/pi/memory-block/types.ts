import type { BeforeAgentStartEvent, BeforeAgentStartEventResult } from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"
import type { LoadDontForgetResult, LoadedMemory, MemoryOperationContext } from "#src/usecases"

export type BeforeAgentStartHandler = (
  event: BeforeAgentStartEvent,
  ctx: MemoryPiContext,
) => Promise<BeforeAgentStartEventResult | undefined>

export type RelevantLoader = () => Promise<string | null>

export type BlockNotifier = (messages: string[]) => void

export interface BlockStart {
  ctx: MemoryPiContext
  context: MemoryOperationContext
  configured: boolean
  loaded: LoadedMemory
  relevant: RelevantLoader
  notify: BlockNotifier
}

export type DontForgetLoader = (context: MemoryOperationContext) => Promise<LoadDontForgetResult>

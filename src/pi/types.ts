import type { ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent"

import type { MemoryAddTool } from "#/pi/memory-add"

export type SessionStartHandler = (event: SessionStartEvent, ctx: ExtensionContext) => void

export interface ExtensionRegistrar {
  registerTool(tool: MemoryAddTool): void
  on(event: "session_start", handler: SessionStartHandler): void
}

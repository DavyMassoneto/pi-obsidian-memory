import type { ExtensionContext } from "@earendil-works/pi-coding-agent"

import type { MemoryAddTool } from "#/pi/memory-add"

export type SessionStartHandler = (event: object, ctx: ExtensionContext) => void

export interface ExtensionRegistrar {
  registerTool(tool: MemoryAddTool): void
  on(event: "session_start", handler: SessionStartHandler): void
}

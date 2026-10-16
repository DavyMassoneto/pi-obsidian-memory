import type { MemoryCommand } from "#src/pi/context"
import type { MemoryAddTool } from "#src/pi/memory-add"
import type { SessionShutdownHandler } from "#src/pi/memory-session"
import type { SessionStartHandler } from "#src/pi/session-start"

export interface ExtensionRegistrar {
  registerTool(tool: MemoryAddTool): void
  registerCommand(name: string, command: MemoryCommand): void
  onSessionStart(handler: SessionStartHandler): void
  onSessionShutdown(handler: SessionShutdownHandler): void
}

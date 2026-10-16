import type { MemoryCommand } from "#src/pi/context"
import type { MemoryAddTool } from "#src/pi/memory-add"
import type { BeforeAgentStartHandler } from "#src/pi/memory-block"
import type { MemoryGetTool } from "#src/pi/memory-get"
import type { MemorySearchTool } from "#src/pi/memory-search"
import type { SessionShutdownHandler } from "#src/pi/memory-session"
import type { SessionStartHandler } from "#src/pi/session-start"
import type { ToolCallHandler } from "#src/pi/vault-guard"

export interface ExtensionRegistrar {
  registerAddTool(tool: MemoryAddTool): void
  registerSearchTool(tool: MemorySearchTool): void
  registerGetTool(tool: MemoryGetTool): void
  registerCommand(name: string, command: MemoryCommand): void
  onSessionStart(handler: SessionStartHandler): void
  onBeforeAgentStart(handler: BeforeAgentStartHandler): void
  onToolCall(handler: ToolCallHandler): void
  onSessionShutdown(handler: SessionShutdownHandler): void
}

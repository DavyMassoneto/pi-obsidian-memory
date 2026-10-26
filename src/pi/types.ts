import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryCommand } from "#src/pi/context"
import type { MemoryAddTool } from "#src/pi/memory-add"
import type { MemoryArchiveTool } from "#src/pi/memory-archive"
import type { BeforeAgentStartHandler } from "#src/pi/memory-block"
import type { MemoryGetTool } from "#src/pi/memory-get"
import type { MemorySearchTool } from "#src/pi/memory-search"
import type { SessionShutdownHandler } from "#src/pi/memory-session"
import type { MemorySucceedTool } from "#src/pi/memory-succeed"
import type { MemoryUpdateTool } from "#src/pi/memory-update"
import type { AgentStartHandler, BeforeCompactHandler, TurnEndHandler } from "#src/pi/observation-cycle"
import type { SessionStartHandler } from "#src/pi/session-start"
import type { ShellEditHandler } from "#src/pi/shell-edit-guard"
import type { ToolCallHandler } from "#src/pi/vault-guard"
import type { LocalModelAccess, ObservationsRecorded } from "#src/usecases"

export interface ExtensionRegistrar {
  registerAddTool(tool: MemoryAddTool): void
  registerSearchTool(tool: MemorySearchTool): void
  registerGetTool(tool: MemoryGetTool): void
  registerUpdateTool(tool: MemoryUpdateTool): void
  registerArchiveTool(tool: MemoryArchiveTool): void
  registerSucceedTool(tool: MemorySucceedTool): void
  registerCommand(name: string, command: MemoryCommand): void
  onSessionStart(handler: SessionStartHandler): void
  onBeforeAgentStart(handler: BeforeAgentStartHandler): void
  onToolCall(handler: ToolCallHandler): void
  onShellToolCall(handler: ShellEditHandler): void
  onTurnEnd(handler: TurnEndHandler): void
  onAgentStart(handler: AgentStartHandler): void
  appendObservations(data: ObservationsRecorded): void
  sendResume(): void
  commandNames(): string[]
  onBeforeCompact(handler: BeforeCompactHandler): void
  onSessionShutdown(handler: SessionShutdownHandler): void
}

export interface ExtensionOverrides {
  completionOf?: CompletionFactory
  localModel?: LocalModelAccess
}

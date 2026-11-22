import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Value } from "typebox/value"

import { SESSION_KEY_CHANNEL, SessionKeyFlagsSchema } from "#src/pi/shell-edit-guard"
import { CONSOLIDATED_TYPE, OBSERVATIONS_TYPE, RECTIFIED_TYPE, RESUME_PROMPT, RESUME_TYPE } from "#src/usecases"
import type { ExtensionRegistrar } from "./types.ts"

export function registrarFor(pi: ExtensionAPI): ExtensionRegistrar {
  return {
    registerAddTool: (tool) => pi.registerTool(tool),
    registerSearchTool: (tool) => pi.registerTool(tool),
    registerGetTool: (tool) => pi.registerTool(tool),
    registerUpdateTool: (tool) => pi.registerTool(tool),
    registerArchiveTool: (tool) => pi.registerTool(tool),
    registerSucceedTool: (tool) => pi.registerTool(tool),
    registerCommand: (name, command) => pi.registerCommand(name, command),
    onSessionStart: (handler) => pi.on("session_start", handler),
    onBeforeAgentStart: (handler) => pi.on("before_agent_start", handler),
    onToolCall: (handler) => pi.on("tool_call", handler),
    onShellToolCall: (handler) => pi.on("tool_call", handler),
    onSessionKey: (handler) => {
      pi.events.on(SESSION_KEY_CHANNEL, (payload) => {
        if (Value.Check(SessionKeyFlagsSchema, payload)) handler(payload)
        else handler(undefined)
      })
    },
    onTurnEnd: (handler) => pi.on("turn_end", handler),
    onAgentStart: (handler) => pi.on("agent_start", handler),
    commandNames: () => pi.getCommands().map((command) => command.name),
    appendObservations: (data) => pi.appendEntry(OBSERVATIONS_TYPE, data),
    appendConsolidated: (data) => pi.appendEntry(CONSOLIDATED_TYPE, data),
    appendRectified: (data) => pi.appendEntry(RECTIFIED_TYPE, data),
    appendCompanion: (record) => pi.appendEntry(record.type, record.data),
    sendResume: () =>
      pi.sendMessage({ customType: RESUME_TYPE, content: RESUME_PROMPT, display: false }, { triggerTurn: true }),
    onBeforeCompact: (handler) => pi.on("session_before_compact", handler),
    onSessionShutdown: (handler) => pi.on("session_shutdown", handler),
  }
}

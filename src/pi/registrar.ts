import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { CURSOR_TYPE } from "#src/pi/capture"
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
    onAgentEnd: (handler) => pi.on("agent_end", handler),
    onBeforeCompact: (handler) => pi.on("session_before_compact", handler),
    appendCursor: (data) => pi.appendEntry(CURSOR_TYPE, data),
    onSessionShutdown: (handler) => pi.on("session_shutdown", handler),
  }
}

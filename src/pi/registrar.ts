import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import type { ExtensionRegistrar } from "./types.ts"

export function registrarFor(pi: ExtensionAPI): ExtensionRegistrar {
  return {
    registerTool: (tool) => pi.registerTool(tool),
    registerCommand: (name, command) => pi.registerCommand(name, command),
    onSessionStart: (handler) => pi.on("session_start", handler),
    onSessionShutdown: (handler) => pi.on("session_shutdown", handler),
  }
}

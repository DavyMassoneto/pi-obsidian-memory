import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { disableClaudeCodeAutoMemory } from "#src/pi/claude-code"
import { memoryAddTool } from "#src/pi/memory-add"
import { MEMORY_INIT_COMMAND, memoryInitCommand } from "#src/pi/memory-init"
import { MemorySessionKeeper } from "#src/pi/memory-session"
import { MEMORY_SETUP_COMMAND, memorySetupCommand } from "#src/pi/memory-setup"
import { memoryConfigPath, memoryIndexPath } from "#src/pi/paths"
import { sessionStartHandler } from "#src/pi/session-start"
import { registrarFor } from "./registrar.ts"
import type { ExtensionRegistrar } from "./types.ts"

export default function extension(pi: ExtensionAPI): void {
  registerExtension(registrarFor(pi), getAgentDir(), process.env)
}

export function registerExtension(registrar: ExtensionRegistrar, agentDir: string, env: NodeJS.ProcessEnv): void {
  disableClaudeCodeAutoMemory(env)
  const paths = { configPath: memoryConfigPath(agentDir), indexPath: memoryIndexPath(agentDir) }
  const sessions = new MemorySessionKeeper()
  registrar.registerTool(memoryAddTool(paths.configPath))
  registrar.registerCommand(MEMORY_SETUP_COMMAND, memorySetupCommand(paths, sessions))
  registrar.registerCommand(MEMORY_INIT_COMMAND, memoryInitCommand(paths, sessions))
  registrar.onSessionStart(sessionStartHandler(paths, sessions))
  registrar.onSessionShutdown(() => sessions.shutdown())
}

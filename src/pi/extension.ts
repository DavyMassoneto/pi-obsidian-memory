import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { disableClaudeCodeAutoMemory } from "#src/pi/claude-code"
import { memoryAddTool } from "#src/pi/memory-add"
import { MemoryBlock } from "#src/pi/memory-block"
import { memoryGetTool } from "#src/pi/memory-get"
import { MEMORY_INIT_COMMAND, memoryInitCommand } from "#src/pi/memory-init"
import { memorySearchTool } from "#src/pi/memory-search"
import { MemorySessionKeeper } from "#src/pi/memory-session"
import { MEMORY_SETUP_COMMAND, memorySetupCommand } from "#src/pi/memory-setup"
import { memoryConfigPath, memoryIndexPath } from "#src/pi/paths"
import { sessionStartHandler } from "#src/pi/session-start"
import { loadDontForget } from "#src/usecases"
import { registrarFor } from "./registrar.ts"
import type { ExtensionRegistrar } from "./types.ts"

export default function extension(pi: ExtensionAPI): void {
  registerExtension(registrarFor(pi), getAgentDir(), process.env)
}

export function registerExtension(registrar: ExtensionRegistrar, agentDir: string, env: NodeJS.ProcessEnv): void {
  disableClaudeCodeAutoMemory(env)
  const paths = { configPath: memoryConfigPath(agentDir), indexPath: memoryIndexPath(agentDir) }
  const sessions = new MemorySessionKeeper()
  const block = new MemoryBlock(loadDontForget)
  registrar.registerAddTool(memoryAddTool(paths.configPath))
  registrar.registerSearchTool(memorySearchTool(paths, sessions))
  registrar.registerGetTool(memoryGetTool(paths, sessions))
  registrar.registerCommand(MEMORY_SETUP_COMMAND, memorySetupCommand(paths, sessions))
  registrar.registerCommand(MEMORY_INIT_COMMAND, memoryInitCommand(paths, sessions))
  registrar.onSessionStart(sessionStartHandler(paths, sessions, block))
  registrar.onBeforeAgentStart(block.beforeAgentStart())
  registrar.onSessionShutdown(() => {
    sessions.shutdown()
    block.clear()
  })
}

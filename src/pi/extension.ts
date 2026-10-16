import { homedir } from "node:os"

import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { disableClaudeCodeAutoMemory } from "#src/pi/claude-code"
import { memoryAddTool } from "#src/pi/memory-add"
import { memoryArchiveTool } from "#src/pi/memory-archive"
import { MemoryBlock } from "#src/pi/memory-block"
import { MEMORY_DOCTOR_COMMAND, memoryDoctorCommand } from "#src/pi/memory-doctor"
import { MEMORY_EXPORT_COMMAND, memoryExportCommand } from "#src/pi/memory-export"
import { memoryGetTool } from "#src/pi/memory-get"
import { MEMORY_INIT_COMMAND, memoryInitCommand } from "#src/pi/memory-init"
import { memorySearchTool } from "#src/pi/memory-search"
import { MemorySessionKeeper } from "#src/pi/memory-session"
import { MEMORY_SETUP_COMMAND, memorySetupCommand } from "#src/pi/memory-setup"
import { memorySucceedTool } from "#src/pi/memory-succeed"
import { memoryUpdateTool } from "#src/pi/memory-update"
import { memoryConfigPath, memoryDataFolder, memoryIndexPath } from "#src/pi/paths"
import { sessionStartHandler } from "#src/pi/session-start"
import { vaultGuardHandler } from "#src/pi/vault-guard"
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
  registrar.registerAddTool(memoryAddTool(paths, sessions))
  registrar.registerSearchTool(memorySearchTool(paths, sessions))
  registrar.registerGetTool(memoryGetTool(paths, sessions))
  registrar.registerUpdateTool(memoryUpdateTool(paths, sessions))
  registrar.registerArchiveTool(memoryArchiveTool(paths, sessions))
  registrar.registerSucceedTool(memorySucceedTool(paths, sessions))
  registrar.registerCommand(MEMORY_SETUP_COMMAND, memorySetupCommand(paths, sessions))
  registrar.registerCommand(MEMORY_INIT_COMMAND, memoryInitCommand(paths, sessions))
  registrar.registerCommand(MEMORY_EXPORT_COMMAND, memoryExportCommand(paths, sessions))
  registrar.registerCommand(MEMORY_DOCTOR_COMMAND, memoryDoctorCommand(paths, sessions))
  registrar.onSessionStart(sessionStartHandler(paths, sessions, block))
  registrar.onBeforeAgentStart(block.beforeAgentStart())
  registrar.onToolCall(vaultGuardHandler(paths.configPath, memoryDataFolder(agentDir), homedir()))
  registrar.onSessionShutdown(() => {
    sessions.shutdown()
    block.clear()
  })
}

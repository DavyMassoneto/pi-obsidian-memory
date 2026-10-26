import { homedir } from "node:os"

import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { type CompletionFactory, registryCompletion } from "#src/pi/completion"
import type { MemoryPaths } from "#src/pi/context"
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
import { agentStartHandler, beforeCompactHandler, ObservationRuntime, turnEndHandler } from "#src/pi/observation-cycle"
import { memoryConfigPath, memoryIndexPath, memoryModelCachePath } from "#src/pi/paths"
import { RelevantMemoryRuntime } from "#src/pi/relevant-memory"
import { SemanticRuntime } from "#src/pi/semantic"
import { sessionStartHandler } from "#src/pi/session-start"
import { shellEditGuardHandler } from "#src/pi/shell-edit-guard"
import { vaultGuardHandler } from "#src/pi/vault-guard"
import { loadDontForget } from "#src/usecases"
import { registrarFor } from "./registrar.ts"
import type { ExtensionOverrides, ExtensionRegistrar } from "./types.ts"

export default function extension(pi: ExtensionAPI): void {
  registerExtension(registrarFor(pi), getAgentDir())
}

export function registerExtension(
  registrar: ExtensionRegistrar,
  agentDir: string,
  overrides?: ExtensionOverrides,
): void {
  const paths = { configPath: memoryConfigPath(agentDir), indexPath: memoryIndexPath(agentDir) }
  const semantic = new SemanticRuntime(memoryModelCachePath(agentDir), overrides?.localModel)
  const sessions = new MemorySessionKeeper(semantic)
  const block = new MemoryBlock(loadDontForget)
  registerTools(registrar, paths, sessions)
  registerCommands(registrar, paths, sessions, memoryModelCachePath(agentDir))
  let completionOf: CompletionFactory = registryCompletion
  if (overrides?.completionOf) completionOf = overrides.completionOf
  const relevant = new RelevantMemoryRuntime({ paths, sessions, completionOf })
  const cycle = new ObservationRuntime({
    paths,
    sessions,
    completionOf,
    appendObservations: (data) => registrar.appendObservations(data),
    sendResume: () => registrar.sendResume(),
  })
  registrar.onSessionStart(sessionStartHandler(paths, sessions, block, relevant, cycle))
  registrar.onBeforeAgentStart(block.beforeAgentStart())
  registrar.onBeforeAgentStart(relevant.beforeAgentStart())
  registrar.onTurnEnd(turnEndHandler(cycle))
  registrar.onAgentStart(agentStartHandler(cycle))
  registrar.onBeforeCompact(beforeCompactHandler(cycle))
  registrar.onToolCall(vaultGuardHandler(paths.configPath, homedir()))
  registrar.onShellToolCall(shellEditGuardHandler())
  registrar.onSessionShutdown(async () => {
    cycle.stop()
    sessions.shutdown()
    await block.settled()
    block.clear()
    await semantic.shutdown()
  })
}

function registerTools(registrar: ExtensionRegistrar, paths: MemoryPaths, sessions: MemorySessionKeeper): void {
  registrar.registerAddTool(memoryAddTool(paths, sessions))
  registrar.registerSearchTool(memorySearchTool(paths, sessions))
  registrar.registerGetTool(memoryGetTool(paths, sessions))
  registrar.registerUpdateTool(memoryUpdateTool(paths, sessions))
  registrar.registerArchiveTool(memoryArchiveTool(paths, sessions))
  registrar.registerSucceedTool(memorySucceedTool(paths, sessions))
}

function registerCommands(
  registrar: ExtensionRegistrar,
  paths: MemoryPaths,
  sessions: MemorySessionKeeper,
  modelCachePath: string,
): void {
  registrar.registerCommand(MEMORY_SETUP_COMMAND, memorySetupCommand(paths, sessions))
  registrar.registerCommand(MEMORY_INIT_COMMAND, memoryInitCommand(paths, sessions))
  registrar.registerCommand(MEMORY_EXPORT_COMMAND, memoryExportCommand(paths, sessions))
  registrar.registerCommand(
    MEMORY_DOCTOR_COMMAND,
    memoryDoctorCommand(paths, sessions, modelCachePath, () => registrar.commandNames()),
  )
}

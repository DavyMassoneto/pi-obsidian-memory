import { homedir } from "node:os"

import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"

import { type CompletionFactory, registryCompletion } from "#src/pi/completion"
import { MEMORY_ADD_TOOL_NAME, memoryAddTool } from "#src/pi/memory-add"
import { MEMORY_ARCHIVE_TOOL_NAME, memoryArchiveTool } from "#src/pi/memory-archive"
import { MemoryBlock } from "#src/pi/memory-block"
import { MEMORY_DOCTOR_COMMAND, memoryDoctorCommand } from "#src/pi/memory-doctor"
import { MEMORY_EXPORT_COMMAND, memoryExportCommand } from "#src/pi/memory-export"
import { MEMORY_GET_TOOL_NAME, memoryGetTool } from "#src/pi/memory-get"
import { MEMORY_IMPORT_COMMAND, memoryImportCommand } from "#src/pi/memory-import"
import { MEMORY_INIT_COMMAND, memoryInitCommand } from "#src/pi/memory-init"
import { MEMORY_SEARCH_TOOL_NAME, memorySearchTool } from "#src/pi/memory-search"
import { MemorySessionKeeper } from "#src/pi/memory-session"
import { MEMORY_SETUP_COMMAND, memorySetupCommand } from "#src/pi/memory-setup"
import { MEMORY_SUCCEED_TOOL_NAME, memorySucceedTool } from "#src/pi/memory-succeed"
import { MEMORY_UPDATE_TOOL_NAME, memoryUpdateTool } from "#src/pi/memory-update"
import { agentStartHandler, beforeCompactHandler, ObservationRuntime, turnEndHandler } from "#src/pi/observation-cycle"
import { memoryConfigPath, memoryIndexPath, memoryModelCachePath } from "#src/pi/paths"
import { RelevantMemoryRuntime } from "#src/pi/relevant-memory"
import { SemanticRuntime } from "#src/pi/semantic"
import { sessionStartHandler } from "#src/pi/session-start"
import { shellEditGuardEnabled, shellEditGuardHandler } from "#src/pi/shell-edit-guard"
import { vaultGuardHandler } from "#src/pi/vault-guard"
import { loadDontForget } from "#src/usecases"
import { entryParts } from "./entry-parts.ts"
import { registrarFor } from "./registrar.ts"
import type {
  CommandDeps,
  CycleMemoryDeps,
  EntryParts,
  ExtensionOverrides,
  ExtensionRegistrar,
  OptionalDeps,
  ToolDeps,
} from "./types.ts"

export default function extension(pi: ExtensionAPI): void {
  registerExtension(registrarFor(pi), getAgentDir())
}

export function registerExtension(
  registrar: ExtensionRegistrar,
  agentDir: string,
  overrides?: ExtensionOverrides,
  entry?: EntryParts,
): void {
  const parts = partsOf(entry)
  const paths = { configPath: memoryConfigPath(agentDir), indexPath: memoryIndexPath(agentDir) }
  const semantic = new SemanticRuntime(memoryModelCachePath(agentDir), overrides?.localModel)
  const sessions = new MemorySessionKeeper(semantic)
  const block = new MemoryBlock(loadDontForget)
  let completionOf: CompletionFactory = registryCompletion
  if (overrides?.completionOf) completionOf = overrides.completionOf
  registerTools(registrar, { paths, sessions }, parts.tools)
  registerCommands(
    registrar,
    { paths, sessions, completionOf, modelCachePath: memoryModelCachePath(agentDir) },
    parts.commands,
  )
  const relevant = new RelevantMemoryRuntime({ paths, sessions, completionOf })
  const cycle = cycleFor(registrar, { paths, sessions, completionOf })
  registrar.onSessionStart(sessionStartHandler(paths, sessions, block, relevant, cycle))
  registrar.onBeforeAgentStart(block.beforeAgentStart())
  registrar.onBeforeAgentStart(relevant.beforeAgentStart())
  registerOptionalParts(registrar, parts, { configPath: paths.configPath, cycle })
  registrar.onSessionShutdown(async () => {
    cycle.stop()
    sessions.shutdown()
    await block.settled()
    block.clear()
    await semantic.shutdown()
  })
}

function cycleFor(registrar: ExtensionRegistrar, memory: CycleMemoryDeps): ObservationRuntime {
  return new ObservationRuntime({
    ...memory,
    appendObservations: (data) => registrar.appendObservations(data),
    appendConsolidated: (data) => registrar.appendConsolidated(data),
    appendRectified: (data) => registrar.appendRectified(data),
    appendCompanion: (record) => registrar.appendCompanion(record),
    sendResume: () => registrar.sendResume(),
  })
}

function partsOf(entry: EntryParts | undefined): EntryParts {
  if (entry) return entry
  return entryParts("full")
}

function registerOptionalParts(registrar: ExtensionRegistrar, parts: EntryParts, optional: OptionalDeps): void {
  if (parts.cycle) registerCycle(registrar, optional.cycle)
  if (parts.vaultGuard) registrar.onToolCall(vaultGuardHandler(optional.configPath, homedir()))
  if (parts.shellEditGuard) registerShellEditGuard(registrar)
}

function registerCycle(registrar: ExtensionRegistrar, cycle: ObservationRuntime): void {
  registrar.onTurnEnd(turnEndHandler(cycle))
  registrar.onAgentStart(agentStartHandler(cycle))
  registrar.onBeforeCompact(beforeCompactHandler(cycle))
}

function registerShellEditGuard(registrar: ExtensionRegistrar): void {
  let enabled = true
  registrar.onSessionKey((payload) => {
    enabled = shellEditGuardEnabled(payload)
  })
  registrar.onShellToolCall(shellEditGuardHandler(() => enabled))
}

function registerTools(registrar: ExtensionRegistrar, memory: ToolDeps, names: readonly string[]): void {
  const { paths, sessions } = memory
  if (names.includes(MEMORY_ADD_TOOL_NAME)) registrar.registerAddTool(memoryAddTool(paths, sessions))
  if (names.includes(MEMORY_SEARCH_TOOL_NAME)) registrar.registerSearchTool(memorySearchTool(paths, sessions))
  if (names.includes(MEMORY_GET_TOOL_NAME)) registrar.registerGetTool(memoryGetTool(paths, sessions))
  if (names.includes(MEMORY_UPDATE_TOOL_NAME)) registrar.registerUpdateTool(memoryUpdateTool(paths, sessions))
  if (names.includes(MEMORY_ARCHIVE_TOOL_NAME)) registrar.registerArchiveTool(memoryArchiveTool(paths, sessions))
  if (names.includes(MEMORY_SUCCEED_TOOL_NAME)) registrar.registerSucceedTool(memorySucceedTool(paths, sessions))
}

function registerCommands(registrar: ExtensionRegistrar, commands: CommandDeps, names: readonly string[]): void {
  const { paths, sessions, completionOf, modelCachePath } = commands
  if (names.includes(MEMORY_SETUP_COMMAND))
    registrar.registerCommand(MEMORY_SETUP_COMMAND, memorySetupCommand(paths, sessions))
  if (names.includes(MEMORY_INIT_COMMAND))
    registrar.registerCommand(MEMORY_INIT_COMMAND, memoryInitCommand(paths, sessions))
  if (names.includes(MEMORY_EXPORT_COMMAND))
    registrar.registerCommand(MEMORY_EXPORT_COMMAND, memoryExportCommand(paths, sessions))
  if (names.includes(MEMORY_IMPORT_COMMAND))
    registrar.registerCommand(MEMORY_IMPORT_COMMAND, memoryImportCommand(paths, sessions, completionOf))
  if (names.includes(MEMORY_DOCTOR_COMMAND))
    registrar.registerCommand(
      MEMORY_DOCTOR_COMMAND,
      memoryDoctorCommand(paths, sessions, modelCachePath, () => registrar.commandNames()),
    )
}

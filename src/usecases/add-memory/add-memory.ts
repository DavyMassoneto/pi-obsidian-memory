import {
  createMemoryNote,
  displayNotePath,
  type ExistingNoteRefusal,
  newNote,
  newNoteId,
  type ReadNoteResult,
  readConfig,
  readNote,
  refreshIndexes,
  targetVault,
  today,
} from "#/services"
import { maintenanceProblemsOf } from "./maintenance.ts"
import type { AddMemoryRequest, AddMemoryResult, MemoryContext } from "./types.ts"

export async function addMemory(request: AddMemoryRequest, context: MemoryContext): Promise<AddMemoryResult> {
  const config = await readConfig(context.configPath)
  if (!config.succeeded) {
    return config
  }

  const target = targetVault(config.output, request.scope, context.workingFolder)
  if (!target.succeeded) {
    return { ...target, configPath: context.configPath }
  }

  const { path, name } = target.output
  const { limits } = config.output
  const created = await createMemoryNote(path, request.folder, newNote(request.draft, newNoteId(), today()), limits)
  if (!created.succeeded && created.reason === "exists") {
    const existing = await readNote(path, request.folder, created.existingStatement, limits)
    return refuseExisting(created, existing)
  }

  if (!created.succeeded) {
    return created
  }

  const refreshed = await refreshIndexes(path, request.folder, name, limits)
  const maintenanceProblems = [...maintenanceProblemsOf(created), ...maintenanceProblemsOf(refreshed)]
  const notePath = displayNotePath(request.folder, created.output.note.statement)
  return {
    succeeded: true,
    output: { vaultName: name, folder: request.folder, notePath, stored: created.output, maintenanceProblems },
  }
}

function refuseExisting(refusal: ExistingNoteRefusal, existing: ReadNoteResult): AddMemoryResult {
  if (!existing.succeeded) {
    return refusal
  }

  return { succeeded: false, reason: "exists", problems: refusal.problems, existing: existing.output }
}

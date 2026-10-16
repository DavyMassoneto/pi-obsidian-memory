import {
  createMemoryNote,
  displayNotePath,
  type ExistingNoteRefusal,
  newNote,
  newNoteId,
  type ReadNoteResult,
  readConfig,
  readNote,
  targetVault,
  today,
} from "#src/services"
import { maintainAddedMemory } from "./maintenance.ts"
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
  const vault = { path, name, limits }
  const created = await createMemoryNote(vault, request.folder, newNote(request.draft, newNoteId(), today()))
  if (!created.succeeded && created.reason === "exists") {
    const existing = await readNote(vault, request.folder, created.existingStatement)
    return refuseExisting(created, existing)
  }

  if (!created.succeeded) {
    return created
  }

  const maintenanceProblems = await maintainAddedMemory(vault, request.folder, created)
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

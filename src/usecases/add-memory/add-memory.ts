import {
  createMemoryNote,
  displayNotePath,
  findNote,
  newNote,
  type ReadNoteResult,
  readConfig,
  refreshIndexes,
  targetVault,
  type VaultRefusal,
} from "#/services"
import type { AddMemoryRequest, AddMemoryResult, MemoryContext } from "./types.ts"

export async function addMemory(request: AddMemoryRequest, context: MemoryContext): Promise<AddMemoryResult> {
  const config = await readConfig(context.configPath)
  if (!config.succeeded) {
    return config
  }

  const target = targetVault(config.output, request.scope, context.workingFolder)
  if (!target.succeeded) {
    return target
  }

  const { path, name } = target.output
  const { limits } = config.output
  const created = await createMemoryNote(path, request.folder, newNote(request.draft), limits)
  if (!created.succeeded && created.reason === "exists") {
    const existing = await findNote(path, request.folder, request.draft.statement, limits)
    return refuseExisting(created, existing)
  }

  if (!created.succeeded) {
    return created
  }

  const refreshed = await refreshIndexes(path, request.folder, name, limits)
  if (!refreshed.succeeded) {
    return { succeeded: false, reason: "not-writable", problems: refreshed.problems }
  }

  const notePath = displayNotePath(request.folder, created.output.note.statement)
  return { succeeded: true, output: { vaultName: name, folder: request.folder, notePath, stored: created.output } }
}

function refuseExisting(refusal: VaultRefusal, existing: ReadNoteResult): AddMemoryResult {
  if (!existing.succeeded) {
    return refusal
  }

  return { ...refusal, reason: "exists", existing: existing.output }
}

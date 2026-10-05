import {
  createNote,
  displayNotePath,
  findNote,
  newNote,
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
  const created = await createNote(path, request.folder, newNote(request.draft), config.output.limits)
  if (!created.succeeded) {
    return refuseCreation(path, request, created)
  }

  const refreshed = await refreshIndexes(path, request.folder, name)
  if (!refreshed.succeeded) {
    return { succeeded: false, reason: "not-writable", problems: refreshed.problems }
  }

  const notePath = displayNotePath(request.folder, created.output.note.statement)
  return { succeeded: true, output: { vaultName: name, folder: request.folder, notePath, stored: created.output } }
}

async function refuseCreation(
  vault: string,
  request: AddMemoryRequest,
  refusal: VaultRefusal,
): Promise<AddMemoryResult> {
  if (refusal.reason !== "exists") {
    return refusal
  }

  const existing = await findNote(vault, request.folder, request.draft.statement)
  if (!existing.succeeded) {
    return refusal
  }

  return { ...refusal, reason: "exists", existing: existing.output }
}

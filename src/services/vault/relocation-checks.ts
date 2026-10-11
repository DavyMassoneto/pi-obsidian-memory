import { checkNote, type PlacedNote } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { findFileIgnoringCase, hashOf, readRawFile, removeFile } from "#/services/vault/filesystem"
import { displayNotePath } from "./display.ts"
import { noteFileName } from "./paths.ts"
import { refuseExisting, refuseWrite } from "./refusals.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { CheckResult, RelocationRequest, RemovalResult } from "./types.ts"

export async function checkRelocation(vault: VaultContext, request: RelocationRequest): Promise<CheckResult> {
  const unchanged = await checkUnchanged(vault.path, request.original, request.hashWhenRead)
  if (!unchanged.succeeded) {
    return unchanged
  }

  for (const placed of request.written) {
    const problems = checkNote(placed.note, vault.limits)
    if (problems.length > 0) {
      return { succeeded: false, reason: "invalid", problems }
    }

    const free = await checkFree(vault.path, placed)
    if (!free.succeeded) {
      return free
    }
  }
  return { succeeded: true }
}

async function checkUnchanged(vault: string, placed: PlacedNote, hashWhenRead: string): Promise<CheckResult> {
  const path = await resolveFile(vault, placed.folder, noteFileName(placed.note.statement))
  if (!path.succeeded) {
    return path
  }
  return checkHash(path.output, placed, hashWhenRead)
}

async function checkHash(path: string, placed: PlacedNote, hashWhenRead: string): Promise<CheckResult> {
  const current = await readRawFile(path)
  if (!current.succeeded && current.reason !== "not-found") {
    return current
  }
  if (!current.succeeded || hashOf(current.output) !== hashWhenRead) {
    const problem = `${displayNotePath(placed.folder, placed.note.statement)} changed on disk since it was read`
    return { succeeded: false, reason: "conflict", problems: [problem] }
  }
  return { succeeded: true }
}

async function checkFree(vault: string, placed: PlacedNote): Promise<CheckResult> {
  const directory = await resolveFolder(vault, placed.folder)
  if (!directory.succeeded) {
    return directory
  }

  const existing = await findFileIgnoringCase(directory.output, noteFileName(placed.note.statement))
  if (existing.succeeded) {
    return refuseExisting(placed.folder, existing.output)
  }
  if (existing.reason !== "not-found") {
    return existing
  }
  return { succeeded: true }
}

export async function removeOriginal(vault: string, request: RelocationRequest): Promise<RemovalResult> {
  const { original, hashWhenRead } = request
  const path = await resolveFile(vault, original.folder, noteFileName(original.note.statement))
  if (!path.succeeded) {
    return path
  }

  const unchanged = await checkHash(path.output, original, hashWhenRead)
  if (!unchanged.succeeded) {
    return unchanged
  }

  const removed = await removeFile(path.output)
  if (!removed.succeeded) {
    return refuseWrite(original.folder, original.note.statement, removed)
  }
  return { succeeded: true, output: path.output }
}

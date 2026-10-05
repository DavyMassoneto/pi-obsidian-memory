import { join } from "node:path"

import { checkNote, type NoteLimits, type PlacedNote } from "#/domain"
import { createNote } from "./create.ts"
import { findFileIgnoringCase, hashOf, readRawFile, removeFile } from "./files.ts"
import { displayNotePath, displayPath, noteFileName, notePath } from "./paths.ts"
import { refreshIndexes } from "./refresh.ts"
import { refuseNotWritable } from "./refusals.ts"
import type { CheckResult, RelocationRequest } from "./types.ts"

export async function relocateNote(request: RelocationRequest, limits: NoteLimits): Promise<CheckResult> {
  const checked = await checkRelocation(request, limits)
  if (!checked.succeeded) {
    return checked
  }

  for (const placed of request.written) {
    const created = await createNote(request.vault, placed.folder, placed.note, limits)
    if (!created.succeeded) {
      return created
    }
  }

  const removed = await removeOriginal(request)
  if (!removed.succeeded) {
    return removed
  }

  return refreshFolders(request)
}

async function checkRelocation(request: RelocationRequest, limits: NoteLimits): Promise<CheckResult> {
  const unchanged = await checkUnchanged(request.vault, request.original, request.hashWhenRead)
  if (!unchanged.succeeded) {
    return unchanged
  }

  for (const placed of request.written) {
    const problems = checkNote(placed.note, limits)
    if (problems.length > 0) {
      return { succeeded: false, reason: "invalid", problems }
    }

    const free = await checkFree(request.vault, placed)
    if (!free.succeeded) {
      return free
    }
  }

  return { succeeded: true }
}

async function checkUnchanged(vault: string, placed: PlacedNote, hashWhenRead: string): Promise<CheckResult> {
  const current = await readRawFile(notePath(vault, placed.folder, placed.note.statement))
  if (!current.succeeded || hashOf(current.output) !== hashWhenRead) {
    const problem = `${displayNotePath(placed.folder, placed.note.statement)} changed on disk since it was read`
    return { succeeded: false, reason: "conflict", problems: [problem] }
  }

  return { succeeded: true }
}

async function checkFree(vault: string, placed: PlacedNote): Promise<CheckResult> {
  const existing = await findFileIgnoringCase(join(vault, placed.folder), noteFileName(placed.note.statement))
  if (existing.succeeded) {
    return {
      succeeded: false,
      reason: "exists",
      problems: [`${displayPath(placed.folder, existing.output)} already exists`],
    }
  }

  return { succeeded: true }
}

async function removeOriginal(request: RelocationRequest): Promise<CheckResult> {
  const { vault, original, hashWhenRead } = request

  const unchanged = await checkUnchanged(vault, original, hashWhenRead)
  if (!unchanged.succeeded) {
    return unchanged
  }

  const removed = await removeFile(notePath(vault, original.folder, original.note.statement))
  if (!removed.succeeded) {
    return refuseNotWritable(original.folder, original.note.statement, removed.code)
  }

  return { succeeded: true }
}

async function refreshFolders(request: RelocationRequest): Promise<CheckResult> {
  const folders = new Set([request.original.folder, ...request.written.map((placed) => placed.folder)])

  for (const folder of folders) {
    const refreshed = await refreshIndexes(request.vault, folder, request.vaultName)
    if (!refreshed.succeeded) {
      return { succeeded: false, reason: "not-writable", problems: refreshed.problems }
    }
  }

  return { succeeded: true }
}

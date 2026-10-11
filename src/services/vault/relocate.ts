import { dirname, relative, sep } from "node:path"

import type { NamedVaultContext } from "#/services/vault/context"
import { linkStatOf } from "#/services/vault/filesystem"
import { noteFileName } from "./paths.ts"
import { writeValidatedNote } from "./publish.ts"
import { refreshFolders } from "./refresh-folders.ts"
import { checkRelocation, removeOriginal } from "./relocation-checks.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type {
  PartialRelocation,
  RelocationProgress,
  RelocationRequest,
  RelocationResult,
  RelocationWriteResult,
} from "./types.ts"

export async function relocateNote(vault: NamedVaultContext, request: RelocationRequest): Promise<RelocationResult> {
  const checked = await checkRelocation(vault, request)
  if (!checked.succeeded) {
    return checked
  }

  const root = await resolveFolder(vault.path, "")
  if (!root.succeeded) {
    return root
  }

  const progress: RelocationProgress = { written: [], maintenanceProblems: [] }
  let moved: RelocationWriteResult
  try {
    moved = await writeAndRemove(vault.path, request, progress)
    if (!moved.succeeded) {
      return moved
    }
  } catch (error) {
    if (progress.written.length === 0) {
      throw error
    }

    let problem = "Lifecycle I/O failed after publishing notes"
    if (error instanceof Error) {
      problem = error.message
    }

    return partialOutcome(vault.path, request, progress, { succeeded: false, reason: "io-error", problems: [problem] })
  }

  const removedFolder = relative(root.output, dirname(moved.output)).split(sep).join("/")
  const folders = [removedFolder, request.original.folder, ...request.written.map((placed) => placed.folder)]
  const refreshed = await refreshFolders(vault, folders)
  if (!refreshed.succeeded) {
    progress.maintenanceProblems.push(...refreshed.problems)
  } else if (refreshed.maintenanceProblems) {
    progress.maintenanceProblems.push(...refreshed.maintenanceProblems)
  }

  if (progress.maintenanceProblems.length > 0) {
    return { succeeded: true, maintenanceProblems: progress.maintenanceProblems }
  }
  return { succeeded: true }
}

async function writeAndRemove(
  vault: string,
  request: RelocationRequest,
  progress: RelocationProgress,
): Promise<RelocationWriteResult> {
  for (const placed of request.written) {
    const created = await writeValidatedNote(vault, placed.folder, placed.note)
    if (!created.succeeded) {
      if (progress.written.length === 0) {
        return created
      }
      return partialOutcome(vault, request, progress, created)
    }

    progress.written.push(placed)
    if (created.maintenanceProblems) {
      progress.maintenanceProblems.push(...created.maintenanceProblems)
    }
  }

  const removed = await removeOriginal(vault, request)
  if (!removed.succeeded) {
    return partialOutcome(vault, request, progress, removed)
  }
  return removed
}

async function partialOutcome(
  vault: string,
  request: RelocationRequest,
  progress: RelocationProgress,
  cause: PartialRelocation["cause"],
): Promise<PartialRelocation> {
  return {
    succeeded: false,
    reason: "partial",
    cause,
    problems: [...cause.problems, ...progress.maintenanceProblems],
    written: progress.written,
    originalState: await originalState(vault, request),
  }
}

async function originalState(vault: string, request: RelocationRequest): Promise<PartialRelocation["originalState"]> {
  try {
    const original = request.original
    const path = await resolveFile(vault, original.folder, noteFileName(original.note.statement))
    if (!path.succeeded) {
      return "unknown"
    }

    const stat = await linkStatOf(path.output)
    if (stat.succeeded) {
      return "present"
    }
    if (stat.reason === "not-found") {
      return "missing"
    }
    return "unknown"
  } catch {
    return "unknown"
  }
}

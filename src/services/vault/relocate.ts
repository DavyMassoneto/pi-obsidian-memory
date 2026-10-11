import type { NoteLimits } from "#/domain"
import { linkStatOf } from "#/services/vault/filesystem"
import { noteFileName } from "./paths.ts"
import { writeValidatedNote } from "./publish.ts"
import { refreshFolders } from "./refresh-folders.ts"
import { checkRelocation, removeOriginal } from "./relocation-checks.ts"
import { resolveFile } from "./resolve.ts"
import type { PartialRelocation, RelocationProgress, RelocationRequest, RelocationResult } from "./types.ts"

export async function relocateNote(request: RelocationRequest, limits: NoteLimits): Promise<RelocationResult> {
  const checked = await checkRelocation(request, limits)
  if (!checked.succeeded) return checked
  const progress: RelocationProgress = { written: [], maintenanceProblems: [] }
  try {
    const moved = await writeAndRemove(request, progress)
    if (!moved.succeeded) return moved
  } catch (error) {
    if (progress.written.length === 0) throw error
    let problem = "Lifecycle I/O failed after publishing notes"
    if (error instanceof Error) problem = error.message
    return partialOutcome(request, progress, { succeeded: false, reason: "io-error", problems: [problem] })
  }
  const context = { path: request.vault, name: request.vaultName, limits }
  const folders = [request.original.folder, ...request.written.map((placed) => placed.folder)]
  const refreshed = await refreshFolders(context, folders)
  if (!refreshed.succeeded) progress.maintenanceProblems.push(...refreshed.problems)
  else if (refreshed.maintenanceProblems) progress.maintenanceProblems.push(...refreshed.maintenanceProblems)
  if (progress.maintenanceProblems.length > 0)
    return { succeeded: true, maintenanceProblems: progress.maintenanceProblems }
  return { succeeded: true }
}

async function writeAndRemove(request: RelocationRequest, progress: RelocationProgress): Promise<RelocationResult> {
  for (const placed of request.written) {
    const created = await writeValidatedNote(request.vault, placed.folder, placed.note)
    if (!created.succeeded) {
      if (progress.written.length === 0) return created
      return partialOutcome(request, progress, created)
    }
    progress.written.push(placed)
    if (created.maintenanceProblems) progress.maintenanceProblems.push(...created.maintenanceProblems)
  }
  const removed = await removeOriginal(request)
  if (!removed.succeeded) return partialOutcome(request, progress, removed)
  return { succeeded: true }
}

async function partialOutcome(
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
    originalState: await originalState(request),
  }
}

async function originalState(request: RelocationRequest): Promise<PartialRelocation["originalState"]> {
  try {
    const original = request.original
    const path = await resolveFile(request.vault, original.folder, noteFileName(original.note.statement))
    if (!path.succeeded) return "unknown"
    const stat = await linkStatOf(path.output)
    if (stat.succeeded) return "present"
    if (stat.reason === "not-found") return "missing"
    return "unknown"
  } catch {
    return "unknown"
  }
}

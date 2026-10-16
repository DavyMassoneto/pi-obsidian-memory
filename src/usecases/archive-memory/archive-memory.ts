import { archiveStoredFile, displayNotePath, today } from "#src/services"
import { changeLeasedMemory, reportPartial, warningsOf } from "#src/usecases/memory-change"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { ArchiveMemoryRequest, ArchiveMemoryResult } from "./types.ts"

export async function archiveMemory(
  request: ArchiveMemoryRequest,
  context: MemoryOperationContext,
): Promise<ArchiveMemoryResult> {
  const address = { vault: request.vault, path: request.path }
  return changeLeasedMemory(address, context, async ({ target, receipted }) => {
    const { note, folder, read } = receipted
    const archived = await archiveStoredFile(target.vault, {
      path: read.path,
      note: { folder, note },
      hashWhenRead: read.rawHash,
      today: today(),
    })
    if (!archived.succeeded) return reportPartial(archived)
    const { folder: archiveFolder, note: archivedNote } = archived.output
    const archivedPath = displayNotePath(archiveFolder, archivedNote.statement)
    return {
      succeeded: true,
      output: { vault: request.vault, path: request.path, archivedPath, maintenanceProblems: warningsOf(archived) },
    }
  })
}

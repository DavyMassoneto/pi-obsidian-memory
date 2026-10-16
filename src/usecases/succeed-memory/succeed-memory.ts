import { displayNotePath, newNote, newNoteId, succeedStoredFile, today } from "#src/services"
import { changeLeasedMemory, reportPartial, warningsOf } from "#src/usecases/memory-change"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { SucceedMemoryRequest, SucceedMemoryResult } from "./types.ts"

export async function succeedMemory(
  request: SucceedMemoryRequest,
  context: MemoryOperationContext,
): Promise<SucceedMemoryResult> {
  const address = { vault: request.vault, path: request.path }
  return changeLeasedMemory(address, context, async ({ target, receipted }) => {
    const { note, folder, read } = receipted
    const day = today()
    const succeeded = await succeedStoredFile(target.vault, {
      path: read.path,
      previous: { folder, note },
      hashWhenRead: read.rawHash,
      successor: { folder: request.folder, note: newNote(request.draft, newNoteId(), day) },
      today: day,
    })
    if (!succeeded.succeeded) return reportPartial(succeeded)
    const { archived, successor } = succeeded.output
    return {
      succeeded: true,
      output: {
        vault: request.vault,
        path: request.path,
        archivedPath: displayNotePath(archived.folder, archived.note.statement),
        successorPath: displayNotePath(successor.folder, successor.note.statement),
        maintenanceProblems: warningsOf(succeeded),
      },
    }
  })
}

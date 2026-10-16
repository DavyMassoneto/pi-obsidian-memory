import { type Note, type NoteChange, refreshIndexes, today, updatedNote, updateStoredFile } from "#src/services"
import { changeLeasedMemory, refreshWarnings, warningsOf } from "#src/usecases/memory-change"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { UpdateMemoryRequest, UpdateMemoryResult } from "./types.ts"

export async function updateMemory(
  request: UpdateMemoryRequest,
  context: MemoryOperationContext,
): Promise<UpdateMemoryResult> {
  const address = { vault: request.vault, path: request.path }
  return changeLeasedMemory(address, context, async ({ target, receipted }) => {
    const { note, folder, read } = receipted
    const updated = await updateStoredFile(target.vault, {
      path: read.path,
      note: updatedNote(note, changeOf(request, note), today()),
      expectedHash: read.rawHash,
    })
    if (!updated.succeeded) return updated
    const refreshed = await refreshIndexes(target.vault, folder)
    const maintenanceProblems = [...warningsOf(updated), ...refreshWarnings(refreshed)]
    return { succeeded: true, output: { vault: request.vault, path: request.path, maintenanceProblems } }
  })
}

function changeOf(request: UpdateMemoryRequest, note: Note): NoteChange {
  let { type } = note.frontmatter
  if (typeof request.type === "string") type = request.type
  let dontForget = "dontForget" in note.frontmatter
  if (typeof request.dontForget === "boolean") dontForget = request.dontForget
  return { body: request.body, type, dontForget }
}

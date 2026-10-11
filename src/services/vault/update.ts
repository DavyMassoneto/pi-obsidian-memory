import type { Note } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { noteFileName, storedFilePath } from "./paths.ts"
import type { ExactUpdateRequest, UpdateResult } from "./types.ts"
import { updateNoteFile } from "./update-file.ts"

export async function updateStoredFile(vault: VaultContext, request: ExactUpdateRequest): Promise<UpdateResult> {
  return updateNoteFile(
    vault,
    { ...storedFilePath(request.path), note: request.note, expectedHash: request.expectedHash },
    request.path,
  )
}

export async function updateNote(
  vault: VaultContext,
  folder: string,
  note: Note,
  hashWhenRead: string,
): Promise<UpdateResult> {
  return updateNoteFile(vault, { folder, fileName: noteFileName(note.statement), note, expectedHash: hashWhenRead })
}

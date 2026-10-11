import type { Note, NoteLimits } from "#/domain"
import { noteFileName } from "./paths.ts"
import type { UpdateResult } from "./types.ts"
import { updateNoteFile } from "./update-file.ts"

export async function updateNote(
  vault: string,
  folder: string,
  note: Note,
  hashWhenRead: string,
  limits: NoteLimits,
): Promise<UpdateResult> {
  return updateNoteFile(
    { path: vault, limits },
    { folder, fileName: noteFileName(note.statement), note, expectedHash: hashWhenRead },
  )
}

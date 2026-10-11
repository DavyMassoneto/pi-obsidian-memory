import type { Note } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { noteFileName } from "./paths.ts"
import type { UpdateResult } from "./types.ts"
import { updateNoteFile } from "./update-file.ts"

export async function updateNote(
  vault: VaultContext,
  folder: string,
  note: Note,
  hashWhenRead: string,
): Promise<UpdateResult> {
  return updateNoteFile(vault, { folder, fileName: noteFileName(note.statement), note, expectedHash: hashWhenRead })
}

import { archiveNote } from "#/domain"
import { relocateNote } from "./relocate.ts"
import type { ArchiveRequest, NamedVaultContext, PlacedResult } from "./types.ts"

export async function archiveStoredNote(vault: NamedVaultContext, request: ArchiveRequest): Promise<PlacedResult> {
  const archived = archiveNote(request.note, request.today)
  const relocated = await relocateNote(vault, {
    original: request.note,
    hashWhenRead: request.hashWhenRead,
    written: [archived],
  })
  if (!relocated.succeeded) {
    return relocated
  }

  return { ...relocated, output: archived }
}

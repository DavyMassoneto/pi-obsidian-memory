import { archiveNote } from "#/domain/lifecycle"
import type { NoteLimits } from "#/domain/note"
import { relocateNote } from "./relocate.ts"
import type { ArchiveRequest, PlacedResult } from "./types.ts"

export async function archiveStoredNote(
  vault: string,
  vaultName: string,
  request: ArchiveRequest,
  limits: NoteLimits,
): Promise<PlacedResult> {
  const archived = archiveNote(request.note, request.today)

  const relocated = await relocateNote(
    { vault, vaultName, original: request.note, hashWhenRead: request.hashWhenRead, written: [archived] },
    limits,
  )
  if (!relocated.succeeded) {
    return relocated
  }

  return { succeeded: true, output: archived }
}

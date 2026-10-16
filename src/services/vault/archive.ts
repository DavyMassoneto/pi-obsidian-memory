import { archiveNote } from "#src/domain"
import type { NamedVaultContext } from "#src/services/vault/context"
import { relocateNote } from "./relocate.ts"
import type { ArchiveRequest, ExactArchiveRequest, PlacedResult } from "./types.ts"

export async function archiveStoredNote(vault: NamedVaultContext, request: ArchiveRequest): Promise<PlacedResult> {
  return archiveOriginal(vault, request, null)
}

export async function archiveStoredFile(vault: NamedVaultContext, request: ExactArchiveRequest): Promise<PlacedResult> {
  return archiveOriginal(vault, request, request.path)
}

async function archiveOriginal(
  vault: NamedVaultContext,
  request: ArchiveRequest,
  originalPath: string | null,
): Promise<PlacedResult> {
  const archived = archiveNote(request.note, request.today)
  const relocated = await relocateNote(vault, {
    original: request.note,
    originalPath,
    hashWhenRead: request.hashWhenRead,
    written: [archived],
  })
  if (!relocated.succeeded) {
    return relocated
  }

  return { ...relocated, output: archived }
}

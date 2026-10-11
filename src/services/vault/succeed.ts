import { checkMemoryFolder, succeedNote } from "#/domain"
import type { NamedVaultContext } from "#/services/vault/context"
import { resolveMemoryFolder } from "./memory-folder.ts"
import { relocateNote } from "./relocate.ts"
import type { SucceedRequest, SuccessionResult } from "./types.ts"

export async function succeedStoredNote(vault: NamedVaultContext, request: SucceedRequest): Promise<SuccessionResult> {
  const problems = checkMemoryFolder(request.successor.folder)
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const destination = await resolveMemoryFolder(vault.path, request.successor.folder)
  if (!destination.succeeded) {
    return destination
  }

  const succession = succeedNote(request.previous, request.successor, request.today)
  const relocated = await relocateNote(vault, {
    original: request.previous,
    hashWhenRead: request.hashWhenRead,
    written: [succession.archived, succession.successor],
  })
  if (!relocated.succeeded) {
    return relocated
  }

  return { ...relocated, output: succession }
}

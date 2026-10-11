import { checkMemoryFolder, type NoteLimits, succeedNote } from "#/domain"
import { resolveMemoryFolder } from "./memory-folder.ts"
import { relocateNote } from "./relocate.ts"
import type { SucceedRequest, SuccessionResult } from "./types.ts"

export async function succeedStoredNote(
  vault: string,
  vaultName: string,
  request: SucceedRequest,
  limits: NoteLimits,
): Promise<SuccessionResult> {
  const problems = checkMemoryFolder(request.successor.folder)
  if (problems.length > 0) return { succeeded: false, reason: "invalid", problems }
  const destination = await resolveMemoryFolder(vault, request.successor.folder)
  if (!destination.succeeded) return destination

  const succession = succeedNote(request.previous, request.successor, request.today)

  const relocated = await relocateNote(
    {
      vault,
      vaultName,
      original: request.previous,
      hashWhenRead: request.hashWhenRead,
      written: [succession.archived, succession.successor],
    },
    limits,
  )
  if (!relocated.succeeded) {
    return relocated
  }

  return { ...relocated, output: succession }
}

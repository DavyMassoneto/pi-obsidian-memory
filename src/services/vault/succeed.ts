import { succeedNote } from "#/domain/lifecycle"
import type { NoteLimits } from "#/domain/note"
import { relocateNote } from "./relocate.ts"
import type { SucceedRequest, SuccessionResult } from "./types.ts"

export async function succeedStoredNote(
  vault: string,
  vaultName: string,
  request: SucceedRequest,
  limits: NoteLimits,
): Promise<SuccessionResult> {
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

  return { succeeded: true, output: succession }
}

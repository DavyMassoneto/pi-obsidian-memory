import { checkMemoryFolder, checkNote, type Note, type NoteLimits } from "#/domain"
import { resolveMemoryFolder } from "./memory-folder.ts"
import { writeValidatedNote } from "./publish.ts"
import type { CreateResult } from "./types.ts"

export async function createMemoryNote(
  vault: string,
  folder: string,
  note: Note,
  limits: NoteLimits,
): Promise<CreateResult> {
  const problems = [...checkMemoryFolder(folder), ...checkNote(note, limits)]
  if (problems.length > 0) return { succeeded: false, reason: "invalid", problems }
  const directory = await resolveMemoryFolder(vault, folder)
  if (!directory.succeeded) return directory
  return writeValidatedNote(vault, folder, note)
}

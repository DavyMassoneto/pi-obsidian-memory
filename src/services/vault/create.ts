import { checkMemoryFolder, checkNote, type Note } from "#/domain"
import { resolveMemoryFolder } from "./memory-folder.ts"
import { writeValidatedNote } from "./publish.ts"
import type { CreateResult, VaultContext } from "./types.ts"

export async function createMemoryNote(vault: VaultContext, folder: string, note: Note): Promise<CreateResult> {
  const problems = [...checkMemoryFolder(folder), ...checkNote(note, vault.limits)]
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const directory = await resolveMemoryFolder(vault.path, folder)
  if (!directory.succeeded) {
    return directory
  }

  return writeValidatedNote(vault.path, folder, note)
}

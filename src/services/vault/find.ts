import type { NoteLimits } from "#/domain"
import { findFileIgnoringCase } from "#/services/vault/filesystem"
import { NOTE_EXTENSION } from "./constants.ts"
import { displayNotePath } from "./display.ts"
import { noteFileName } from "./paths.ts"
import { readNote } from "./read.ts"
import { resolveFolder } from "./resolve.ts"
import type { ReadNoteResult } from "./types.ts"

export async function findNote(
  vault: string,
  folder: string,
  statement: string,
  limits: NoteLimits,
): Promise<ReadNoteResult> {
  const directory = await resolveFolder(vault, folder)
  if (!directory.succeeded) {
    return directory
  }

  const existing = await findFileIgnoringCase(directory.output, noteFileName(statement))
  if (!existing.succeeded) {
    if (existing.reason !== "not-found") return existing
    return { succeeded: false, reason: "not-found", problems: [`${displayNotePath(folder, statement)} does not exist`] }
  }

  const realStatement = existing.output.slice(0, -NOTE_EXTENSION.length)
  return readNote(vault, folder, realStatement, limits)
}

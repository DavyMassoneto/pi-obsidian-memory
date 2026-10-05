import { checkNote, type Note, type NoteLimits, renderNote } from "#/domain"
import { hashOf, readRawFile, writeAtomically } from "./files.ts"
import { displayNotePath, noteFileName } from "./paths.ts"
import { refuseNotWritable } from "./refusals.ts"
import { resolveFile } from "./resolve.ts"
import type { VaultResult } from "./types.ts"

export async function updateNote(
  vault: string,
  folder: string,
  note: Note,
  hashWhenRead: string,
  limits: NoteLimits,
): Promise<VaultResult> {
  const problems = checkNote(note, limits)
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const path = await resolveFile(vault, folder, noteFileName(note.statement))
  if (!path.succeeded) {
    return path
  }

  const current = await readRawFile(path.output)
  if (!current.succeeded || hashOf(current.output) !== hashWhenRead) {
    const problem = `${displayNotePath(folder, note.statement)} changed on disk since it was read`
    return { succeeded: false, reason: "conflict", problems: [problem] }
  }

  const text = renderNote(note)
  const written = await writeAtomically(path.output, text)
  if (!written.succeeded) {
    return refuseNotWritable(folder, note.statement, written.code)
  }

  return { succeeded: true, output: { note, hash: hashOf(text) } }
}

import { checkNote, type Note, renderNote } from "#/domain"
import { hashOf, readRawFile, writeAtomically } from "#/services/vault/filesystem"
import { displayNotePath } from "./display.ts"
import { noteFileName } from "./paths.ts"
import { refuseWrite } from "./refusals.ts"
import { resolveFile } from "./resolve.ts"
import type { UpdateResult, VaultContext } from "./types.ts"

export async function updateNote(
  vault: VaultContext,
  folder: string,
  note: Note,
  hashWhenRead: string,
): Promise<UpdateResult> {
  const problems = checkNote(note, vault.limits)
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const path = await resolveFile(vault.path, folder, noteFileName(note.statement))
  if (!path.succeeded) {
    return path
  }

  const current = await readRawFile(path.output)
  if (!current.succeeded && current.reason !== "not-found") {
    return current
  }
  if (!current.succeeded || hashOf(current.output) !== hashWhenRead) {
    const problem = `${displayNotePath(folder, note.statement)} changed on disk since it was read`
    return { succeeded: false, reason: "conflict", problems: [problem] }
  }

  const text = renderNote(note)
  const written = await writeAtomically(path.output, text)
  if (!written.succeeded) {
    return refuseWrite(folder, note.statement, written)
  }

  const result: UpdateResult = { succeeded: true, output: { note, hash: hashOf(text) } }
  if (written.maintenanceProblems) {
    result.maintenanceProblems = written.maintenanceProblems
  }
  return result
}

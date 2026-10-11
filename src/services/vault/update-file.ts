import { checkFileName, checkNote, renderNote } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { hashOf, readRawFile, writeAtomically } from "#/services/vault/filesystem"
import { displayNotePath } from "./display.ts"
import { refuseWrite } from "./refusals.ts"
import { resolveFile } from "./resolve.ts"
import type { UpdateFileRequest, UpdateResult } from "./types.ts"

export async function updateNoteFile(vault: VaultContext, request: UpdateFileRequest): Promise<UpdateResult> {
  const { folder, fileName, note, expectedHash } = request
  const problems = [...checkNote(note, vault.limits), ...checkFileName(fileName)]
  if (fileName.slice(-3).toLowerCase() !== ".md" || fileName.slice(0, -3) !== note.statement) {
    problems.push("The destination filename must match the note statement and have a Markdown extension")
  }
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const path = await resolveFile(vault.path, folder, fileName)
  if (!path.succeeded) {
    return path
  }

  const current = await readRawFile(path.output)
  if (!current.succeeded && current.reason !== "not-found") {
    return current
  }
  if (!current.succeeded || hashOf(current.output) !== expectedHash) {
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

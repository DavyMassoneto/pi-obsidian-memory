import { dirname } from "node:path"

import { type Note, renderNote } from "#/domain"
import { createDirectory, findFileIgnoringCase, hashOf, publishExclusively } from "#/services/vault/filesystem"
import { noteFileName } from "./paths.ts"
import { refuseExisting, refuseWrite } from "./refusals.ts"
import { resolveFile } from "./resolve.ts"
import type { CreateResult } from "./types.ts"

export async function writeValidatedNote(vault: string, folder: string, note: Note): Promise<CreateResult> {
  const path = await resolveFile(vault, folder, noteFileName(note.statement))
  if (!path.succeeded) return path
  const directory = dirname(path.output)
  const made = await createDirectory(directory)
  if (!made.succeeded) return refuseWrite(folder, note.statement, made)
  const existing = await findFileIgnoringCase(directory, noteFileName(note.statement))
  if (existing.succeeded) return refuseExisting(folder, existing.output)
  if (existing.reason !== "not-found") return existing
  const text = renderNote(note)
  const written = await publishExclusively(path.output, text)
  if (!written.succeeded) {
    if (written.reason === "exists") {
      const occupied = await findFileIgnoringCase(directory, noteFileName(note.statement))
      if (!occupied.succeeded) return occupied
      const refused = refuseExisting(folder, occupied.output)
      return { ...refused, problems: [...refused.problems, ...written.problems.slice(1)] }
    }
    return refuseWrite(folder, note.statement, written)
  }
  const result: CreateResult = { succeeded: true, output: { note, hash: hashOf(text) } }
  if (written.maintenanceProblems) result.maintenanceProblems = written.maintenanceProblems
  return result
}

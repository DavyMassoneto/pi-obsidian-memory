import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { checkNote, type Note, type NoteLimits, renderNote } from "#/domain/note"
import { findFileIgnoringCase, hashOf, writeAtomically } from "./files.ts"
import { displayPath, noteFileName, notePath } from "./paths.ts"
import { refuseNotWritable } from "./refusals.ts"
import type { VaultResult } from "./types.ts"

export async function createNote(vault: string, folder: string, note: Note, limits: NoteLimits): Promise<VaultResult> {
  const problems = checkNote(note, limits)
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const directory = join(vault, folder)
  await mkdir(directory, { recursive: true })

  const existing = await findFileIgnoringCase(directory, noteFileName(note.statement))
  if (existing.succeeded) {
    return { succeeded: false, reason: "exists", problems: [`${displayPath(folder, existing.output)} already exists`] }
  }

  const text = renderNote(note)
  const written = await writeAtomically(notePath(vault, folder, note.statement), text)
  if (!written.succeeded) {
    return refuseNotWritable(folder, note.statement, written.code)
  }

  return { succeeded: true, output: { note, hash: hashOf(text) } }
}

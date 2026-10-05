import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import { checkMemoryFolder, checkNote, type Note, type NoteLimits, renderNote } from "#/domain"
import { findFileIgnoringCase, hashOf, writeAtomically } from "./files.ts"
import { displayPath, noteFileName } from "./paths.ts"
import { refuseNotWritable } from "./refusals.ts"
import { resolveFile } from "./resolve.ts"
import type { VaultResult } from "./types.ts"

export async function createMemoryNote(
  vault: string,
  folder: string,
  note: Note,
  limits: NoteLimits,
): Promise<VaultResult> {
  const problems = [...checkMemoryFolder(folder), ...checkNote(note, limits)]
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  return createNote(vault, folder, note, limits)
}

export async function createNote(vault: string, folder: string, note: Note, limits: NoteLimits): Promise<VaultResult> {
  const problems = checkNote(note, limits)
  if (problems.length > 0) {
    return { succeeded: false, reason: "invalid", problems }
  }

  const path = await resolveFile(vault, folder, noteFileName(note.statement))
  if (!path.succeeded) {
    return path
  }

  const directory = dirname(path.output)
  await mkdir(directory, { recursive: true })

  const existing = await findFileIgnoringCase(directory, noteFileName(note.statement))
  if (existing.succeeded) {
    return { succeeded: false, reason: "exists", problems: [`${displayPath(folder, existing.output)} already exists`] }
  }

  const text = renderNote(note)
  const written = await writeAtomically(path.output, text)
  if (!written.succeeded) {
    return refuseNotWritable(folder, note.statement, written.code)
  }

  return { succeeded: true, output: { note, hash: hashOf(text) } }
}

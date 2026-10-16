import { parseNote, validateNote } from "#src/domain"
import type { VaultContext } from "#src/services/vault/context"
import { hashOf, readRawFile } from "#src/services/vault/filesystem"
import { displayNotePath } from "./display.ts"
import { noteFileName } from "./paths.ts"
import { resolveFile } from "./resolve.ts"
import type { ReadNoteResult } from "./types.ts"

export async function readNote(vault: VaultContext, folder: string, statement: string): Promise<ReadNoteResult> {
  const path = await resolveFile(vault.path, folder, noteFileName(statement))
  if (!path.succeeded) {
    return path
  }

  return readResolvedNote(vault, folder, statement, path.output)
}

export async function readResolvedNote(
  vault: VaultContext,
  folder: string,
  statement: string,
  path: string,
): Promise<ReadNoteResult> {
  const file = await readRawFile(path)
  if (!file.succeeded) {
    if (file.reason !== "not-found") {
      return file
    }

    const problem = `${displayNotePath(folder, statement)} does not exist`
    return { succeeded: false, reason: "not-found", problems: [problem] }
  }

  const parsed = parseNote(statement, file.output.toString("utf8"))
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid", problems: parsed.problems }
  }

  const hash = hashOf(file.output)
  const validated = validateNote(parsed.output, vault.limits)
  if (!validated.succeeded) {
    return { succeeded: false, reason: "needs-fixing", problems: validated.problems, parsed: parsed.output, hash }
  }

  return { succeeded: true, output: { note: validated.output, hash } }
}

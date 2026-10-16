import { checkMemoryFolder, type Note, parseNote } from "#src/domain"
import { inspectVaultFile } from "#src/services/vault/catalog"
import type { VaultContext } from "#src/services/vault/context"
import type { Succeeded } from "#src/shared"
import type { BlankCompletionRefusal, CompleteBlankRequest, CompleteBlankResult } from "./types.ts"
import { updateNoteFile } from "./update-file.ts"

export async function completeBlankFile(
  vault: VaultContext,
  request: CompleteBlankRequest,
): Promise<CompleteBlankResult> {
  const inspected = await inspectVaultFile(vault, { path: request.path })
  if (!inspected.succeeded) return inspected
  const current = inspected.output
  if (current.rawHash !== request.expectedHash) {
    return { succeeded: false, reason: "conflict", problems: ["The blank file changed since its preview"] }
  }
  const note = noteToComplete(request.note, current.text)
  if (!note.succeeded) return note

  return completeInspectedBlank(vault, { ...request, note: note.output }, current.canonicalPath)
}

function noteToComplete(note: Note, text: string): Succeeded<Note> | BlankCompletionRefusal {
  if (text.trim() === "") return { succeeded: true, output: note }
  const parsed = parseNote(note.statement, text)
  if (parsed.succeeded) {
    return { succeeded: false, reason: "not-blank", problems: ["The file already has frontmatter"] }
  }
  if (parsed.problems.includes("frontmatter is not closed")) {
    return { succeeded: false, reason: "not-blank", problems: parsed.problems }
  }
  const normalized = text.replaceAll("\r\n", "\n")
  return { succeeded: true, output: { ...note, body: withoutFinalNewline(normalized) } }
}

function withoutFinalNewline(text: string): string {
  if (text.endsWith("\n")) return text.slice(0, -1)
  return text
}

async function completeInspectedBlank(
  vault: VaultContext,
  request: CompleteBlankRequest,
  canonicalPath: string,
): Promise<CompleteBlankResult> {
  const folder = canonicalPath.slice(0, Math.max(0, canonicalPath.lastIndexOf("/")))
  const requestedFolder = request.path.slice(0, Math.max(0, request.path.lastIndexOf("/")))
  const problems = [...checkMemoryFolder(folder), ...checkMemoryFolder(requestedFolder)]
  if (problems.length > 0) return { succeeded: false, reason: "invalid", problems }
  const fileName = canonicalPath.slice(canonicalPath.lastIndexOf("/") + 1)
  const requestedName = request.path.slice(request.path.lastIndexOf("/") + 1)
  if (
    fileName.slice(-3).toLowerCase() !== ".md" ||
    fileName.slice(0, -3) !== request.note.statement ||
    requestedName !== fileName
  ) {
    return {
      succeeded: false,
      reason: "path-mismatch",
      problems: ["The candidate statement must match the blank file"],
    }
  }

  return updateNoteFile(vault, { folder, fileName, note: request.note, expectedHash: request.expectedHash })
}

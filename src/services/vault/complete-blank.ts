import { checkMemoryFolder } from "#src/domain"
import { inspectVaultFile } from "#src/services/vault/catalog"
import type { VaultContext } from "#src/services/vault/context"
import type { CompleteBlankRequest, CompleteBlankResult } from "./types.ts"
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
  if (current.text.trim() !== "") {
    return { succeeded: false, reason: "not-blank", problems: ["Only whitespace-empty files can be completed"] }
  }

  return completeInspectedBlank(vault, request, current.canonicalPath)
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

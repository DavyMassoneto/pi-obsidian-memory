import { basename } from "node:path"

import { checkVaultPath } from "#/domain"
import { realPathOf } from "#/services/vault/filesystem"
import { noteFileName, storedFilePath } from "./paths.ts"
import { resolveFile } from "./resolve.ts"
import type { FileRelocationRequest, ResolveResult } from "./types.ts"

export async function resolveStoredFile(vault: string, path: string, statement: string): Promise<ResolveResult> {
  const { folder, fileName } = storedFilePath(path)
  const problems = [...checkVaultPath(path), ...checkStoredFileName(fileName, statement)]
  if (problems.length > 0) return { succeeded: false, reason: "invalid", problems }

  const resolved = await resolveFile(vault, folder, fileName)
  if (!resolved.succeeded) return resolved
  const canonical = await realPathOf(resolved.output)
  if (!canonical.succeeded) {
    if (canonical.reason === "not-found") return resolved
    return canonical
  }

  const targetProblems = checkStoredFileName(basename(canonical.output), statement)
  if (targetProblems.length > 0) return { succeeded: false, reason: "invalid", problems: targetProblems }
  return canonical
}

export async function resolveOriginalFile(vault: string, request: FileRelocationRequest): Promise<ResolveResult> {
  const { original, originalPath } = request
  if (typeof originalPath !== "string") {
    return resolveFile(vault, original.folder, noteFileName(original.note.statement))
  }
  if (storedFilePath(originalPath).folder !== original.folder) {
    return { succeeded: false, reason: "invalid", problems: ["The original path must match the note folder"] }
  }
  return resolveStoredFile(vault, originalPath, original.note.statement)
}

function checkStoredFileName(fileName: string, statement: string): string[] {
  if (fileName.slice(-3).toLowerCase() !== ".md" || fileName.slice(0, -3) !== statement) {
    return ["The stored filename must match the note statement and have a Markdown extension"]
  }
  return []
}

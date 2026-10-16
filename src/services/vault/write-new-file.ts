import { open } from "node:fs/promises"

import { errorCode, removeFile } from "#src/services/vault/filesystem"
import type { NewFileRefusal, WriteNewFileResult } from "./types.ts"

export async function writeNewFile(path: string, bytes: Uint8Array): Promise<WriteNewFileResult> {
  let created = false
  try {
    const handle = await open(path, "wx")
    created = true
    try {
      await handle.writeFile(bytes)
    } finally {
      await handle.close()
    }
    return { succeeded: true }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    const refusal = refusalOf(error, path)
    if (!created) return refusal
    const removed = await removeFile(path)
    if (removed.succeeded) return refusal
    return { ...refusal, problems: [...refusal.problems, ...removed.problems.map(partialFileProblem)] }
  }
}

function partialFileProblem(problem: string): string {
  return `The partly written file was left behind: ${problem}`
}

function refusalOf(error: Error, path: string): NewFileRefusal {
  const code = errorCode(error)
  const problems = [`${path} cannot be created (${code})`]
  if (code === "EEXIST") return { succeeded: false, reason: "exists", problems }
  if (code === "ENOENT" || code === "ENOTDIR") return { succeeded: false, reason: "not-found", problems }
  return { succeeded: false, reason: "io-error", problems }
}

import { parseNote } from "#/domain"
import { hashOf, readRawFile } from "./files.ts"
import { displayNotePath, notePath } from "./paths.ts"
import type { VaultResult } from "./types.ts"

export async function readNote(vault: string, folder: string, statement: string): Promise<VaultResult> {
  const file = await readRawFile(notePath(vault, folder, statement))
  if (!file.succeeded) {
    const problem = `${displayNotePath(folder, statement)} does not exist`
    return { succeeded: false, reason: "not-found", problems: [problem] }
  }

  const parsed = parseNote(statement, file.output.toString("utf8"))
  if (!parsed.succeeded) {
    return { succeeded: false, reason: "invalid", problems: parsed.problems }
  }

  return { succeeded: true, output: { note: parsed.output, hash: hashOf(file.output) } }
}

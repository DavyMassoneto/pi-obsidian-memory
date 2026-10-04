import { join } from "node:path"

import { NOTE_EXTENSION } from "./constants.ts"
import { findFileIgnoringCase } from "./files.ts"
import { displayNotePath, noteFileName } from "./paths.ts"
import { readNote } from "./read.ts"
import type { VaultResult } from "./types.ts"

export async function findNote(vault: string, folder: string, statement: string): Promise<VaultResult> {
  const existing = await findFileIgnoringCase(join(vault, folder), noteFileName(statement))
  if (!existing.succeeded) {
    return { succeeded: false, reason: "not-found", problems: [`${displayNotePath(folder, statement)} does not exist`] }
  }

  const realStatement = existing.output.slice(0, -NOTE_EXTENSION.length)
  return readNote(vault, folder, realStatement)
}

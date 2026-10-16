import { directoryEntriesOf } from "#src/services/vault/filesystem"
import type { VaultFolderResult } from "./types.ts"

export async function inspectVaultFolder(path: string): Promise<VaultFolderResult> {
  const entries = await directoryEntriesOf(path)
  if (entries.succeeded) {
    if (entries.output.length === 0) return { succeeded: true, output: "empty" }
    return { succeeded: true, output: "populated" }
  }
  if (entries.reason === "not-found") return { succeeded: true, output: "missing" }
  if (entries.reason === "not-directory") return { succeeded: true, output: "not-directory" }
  return { succeeded: false, reason: "io-error", problems: entries.problems }
}

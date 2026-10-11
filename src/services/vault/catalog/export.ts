import type { VaultCatalogFailure, VaultExportFile, VaultExportResult } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { readCatalogBytes } from "./bytes.ts"
import { walkVault } from "./enumerate.ts"

export async function collectExportFiles(vault: VaultContext): Promise<VaultExportResult> {
  const scan = await walkVault({ vault, mode: "export" })
  if (!scan.succeeded) return { succeeded: false, failures: [scan], problems: scan.problems }
  const failures: VaultCatalogFailure[] = [...scan.output.failures]
  const files: VaultExportFile[] = []
  for (const entry of scan.output.entries) {
    if (entry.kind === "folder" || entry.kind === "temporary") continue
    const read = await readCatalogBytes(vault, { path: entry.path, expectedStat: entry.stat })
    if (read.succeeded) files.push(read.output)
    else failures.push(read)
  }
  if (failures.length > 0) {
    return { succeeded: false, failures, problems: failures.flatMap((failure) => failure.problems) }
  }
  return { succeeded: true, output: files }
}

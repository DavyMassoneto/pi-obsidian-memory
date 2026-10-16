import { diagnoseVault, enumerateVault, type InspectedVaultFile, inspectVaultFile } from "#src/services"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { memoryOperationInterruption } from "#src/usecases/operation-context"
import type { ResolvedMemory, ResolvedVault } from "#src/usecases/resolve-memory"
import type { BlankFile, VaultReport, VaultReportFailure } from "./types.ts"

export async function reportVault(
  memory: ResolvedMemory,
  target: ResolvedVault,
  context: MemoryOperationContext,
): Promise<VaultReport | VaultReportFailure> {
  const enumerated = await enumerateVault(target.vault)
  if (!enumerated.succeeded) return { vault: target.scope, problems: enumerated.problems }
  const { entries } = enumerated.output
  const unreadable = enumerated.output.failures.map((failure) => `${failure.path}: ${failure.problems.join("; ")}`)
  const inspected: InspectedVaultFile[] = []
  for (const entry of entries) {
    if (entry.kind !== "note") continue
    if (memoryOperationInterruption(context)) break
    const file = await inspectVaultFile(target.vault, { path: entry.path })
    if (file.succeeded) inspected.push(file.output)
    else unreadable.push(`${entry.path}: ${file.problems.join("; ")}`)
  }
  const diagnosis = diagnoseVault({ entries, inspected, limits: memory.config.limits })
  return { vault: target.scope, diagnosis, blanks: blankFiles(inspected), unreadable }
}

function blankFiles(inspected: InspectedVaultFile[]): BlankFile[] {
  return inspected
    .filter((file) => file.analysis.status === "unclosed")
    .map((file) => ({ path: file.path, rawHash: file.rawHash, empty: file.text.trim() === "" }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

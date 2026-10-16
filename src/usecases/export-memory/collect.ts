import { collectExportFiles, type VaultExportFile } from "#src/services"
import type { ResolvedMemory, ResolvedVault } from "#src/usecases/resolve-memory"
import type { CollectedVaults } from "./types.ts"

export async function collectVaults(memory: ResolvedMemory): Promise<CollectedVaults> {
  const problems: string[] = []
  const global = await collectVault(memory.global, problems)
  let project: VaultExportFile[] | null = null
  if (memory.project) project = await collectVault(memory.project, problems)
  return { global, project, problems }
}

async function collectVault(target: ResolvedVault, problems: string[]): Promise<VaultExportFile[]> {
  const collected = await collectExportFiles(target.vault)
  if (collected.succeeded) return collected.output
  for (const failure of collected.failures) {
    problems.push(`${target.scope}: ${failure.path}: ${failure.problems.join("; ")}`)
  }
  return []
}

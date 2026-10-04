import { type MemoryConfig, resolveProject, vaultNameOf } from "#/domain/config"
import type { MemoryScope, TargetVaultResult } from "./types.ts"

export function targetVault(config: MemoryConfig, scope: MemoryScope, workingFolder: string): TargetVaultResult {
  if (scope === "global") {
    const path = config.global.vault
    return { succeeded: true, output: { path, name: vaultNameOf(path) } }
  }

  const project = resolveProject(config, workingFolder)
  if (!project.succeeded) {
    const problem = `${workingFolder} has no registered project: run /memory-init, or use the global scope`
    return { succeeded: false, reason: "no-project", problems: [problem] }
  }

  return { succeeded: true, output: { path: project.output.vault, name: vaultNameOf(project.output.vault) } }
}

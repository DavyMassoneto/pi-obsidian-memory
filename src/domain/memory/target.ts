import { type MemoryConfig, resolveProject, vaultNameOf } from "#src/domain/config"
import type { PathPlatform } from "#src/domain/path-platform"
import type { MemoryScope, TargetVaultResult } from "./types.ts"

export function targetVault(
  config: MemoryConfig,
  scope: MemoryScope,
  workingFolder: string,
  platform: PathPlatform,
): TargetVaultResult {
  if (scope === "global") {
    const path = config.global.vault
    return { succeeded: true, output: { path, name: vaultNameOf(path, platform) } }
  }

  const project = resolveProject(config, workingFolder, platform)
  if (!project.succeeded) {
    return {
      succeeded: false,
      reason: "no-project",
      workingFolder,
      problems: [`${workingFolder} has no registered project`],
    }
  }

  return { succeeded: true, output: { path: project.output.vault, name: vaultNameOf(project.output.vault, platform) } }
}

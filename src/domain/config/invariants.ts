import type { PathPlatform } from "#src/domain/path-platform"
import { comparablePath, isInside, pathsOverlap } from "./paths.ts"
import type { ConfigInfrastructure, ConfigLocationPaths, ConfigRegistrations, VaultRegistration } from "./types.ts"

export function registrationProblems(config: ConfigRegistrations, platform: PathPlatform): string[] {
  const problems: string[] = []
  const names = new Map<string, string>()
  const folders = new Map<string, string>()
  for (const [index, project] of config.projects.entries()) {
    if (typeof project.name === "string") {
      reportDuplicate(names, project.name.toLowerCase(), `projects.${index}.name`, problems)
    }
    if (typeof project.folder === "string") {
      reportDuplicate(folders, comparablePath(project.folder, platform), `projects.${index}.folder`, problems)
    }
  }
  const vaults = registeredVaults(config)
  for (const [index, vault] of vaults.entries()) {
    for (const other of vaults.slice(index + 1)) {
      if (pathsOverlap(vault.path, other.path, platform)) {
        problems.push(`${vault.field} and ${other.field}: vaults must not be equal or nested`)
      }
    }
  }
  return problems
}

export function registeredVaults(config: ConfigRegistrations): VaultRegistration[] {
  const vaults: VaultRegistration[] = []
  if (typeof config.global.vault === "string") {
    vaults.push({ field: "global.vault", path: config.global.vault })
  }
  for (const [index, project] of config.projects.entries()) {
    if (typeof project.vault === "string") {
      vaults.push({ field: `projects.${index}.vault`, path: project.vault })
    }
  }
  return vaults
}

export function configLocationProblems(request: ConfigLocationPaths, platform: PathPlatform): string[] {
  const problems: string[] = []
  for (const vault of registeredVaults(request.config)) {
    if (isInside(request.configPath, vault.path, platform)) {
      problems.push(`configPath and ${vault.field}: config must remain outside vaults`)
    }
  }
  return problems
}

export function infrastructureProblems(request: ConfigInfrastructure, platform: PathPlatform): string[] {
  const problems = configLocationProblems(request, platform)
  for (const vault of registeredVaults(request.config)) {
    if (pathsOverlap(request.indexPath, vault.path, platform)) {
      problems.push(`indexPath and ${vault.field}: index and vaults must not overlap`)
    }
  }
  return problems
}

function reportDuplicate(seen: Map<string, string>, value: string, field: string, problems: string[]): void {
  const previous = seen.get(value)
  if (typeof previous === "string") {
    problems.push(`${previous} and ${field}: duplicate registration`)
  } else {
    seen.set(value, field)
  }
}

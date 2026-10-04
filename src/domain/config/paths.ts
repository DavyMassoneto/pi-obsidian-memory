import type { MemoryConfig, ProjectEntry, ResolveProjectResult } from "./types.ts"

export function resolveProject(config: MemoryConfig, folder: string): ResolveProjectResult {
  const current = comparablePath(folder)
  const matching = config.projects.filter((project) => isInside(current, comparablePath(project.folder)))
  const mostSpecific = matching.sort(byDeepestFolder)[0]

  if (mostSpecific) {
    return { succeeded: true, output: mostSpecific }
  }

  return { succeeded: false }
}

export function vaultNameOf(vaultPath: string): string {
  const path = normalizedPath(vaultPath)
  return path.slice(path.lastIndexOf("/") + 1)
}

function isInside(folder: string, projectFolder: string): boolean {
  return folder === projectFolder || folder.startsWith(`${projectFolder}/`)
}

function byDeepestFolder(first: ProjectEntry, second: ProjectEntry): number {
  return comparablePath(second.folder).length - comparablePath(first.folder).length
}

function comparablePath(path: string): string {
  return normalizedPath(path).toLowerCase()
}

function normalizedPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "")
}

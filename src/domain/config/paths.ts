import { posix, win32 } from "node:path"

import type { PathPlatform } from "#src/domain/path-platform"
import type { MemoryConfig, ProjectEntry, ResolveProjectResult } from "./types.ts"

export function resolveProject(config: MemoryConfig, folder: string, platform: PathPlatform): ResolveProjectResult {
  const current = comparablePath(folder, platform)
  const matching = config.projects.filter((project) =>
    isInside(current, comparablePath(project.folder, platform), platform),
  )
  const mostSpecific = matching.sort((first, second) => byDeepestFolder(first, second, platform))[0]

  if (mostSpecific) {
    return { succeeded: true, output: mostSpecific }
  }

  return { succeeded: false }
}

export function vaultNameOf(vaultPath: string, platform: PathPlatform): string {
  const path = normalizedPath(vaultPath, platform).replace(/\/+$/, "")
  return path.slice(path.lastIndexOf("/") + 1)
}

export function isInside(folder: string, parent: string, platform: PathPlatform): boolean {
  const current = comparablePath(folder, platform)
  const root = comparablePath(parent, platform)
  if (root.endsWith("/")) {
    return current.startsWith(root)
  }

  return current === root || current.startsWith(`${root}/`)
}

export function pathsOverlap(first: string, second: string, platform: PathPlatform): boolean {
  return isInside(first, second, platform) || isInside(second, first, platform)
}

function byDeepestFolder(first: ProjectEntry, second: ProjectEntry, platform: PathPlatform): number {
  return comparablePath(second.folder, platform).length - comparablePath(first.folder, platform).length
}

export function comparablePath(path: string, platform: PathPlatform): string {
  const normalized = normalizedPath(path, platform)
  if (platform === "linux") return normalized
  return normalized.toLowerCase()
}

function normalizedPath(path: string, platform: PathPlatform): string {
  let separated = path
  if (platform === "win32") separated = path.replaceAll("\\", "/")
  let normalized = posix.normalize(separated)
  if (platform === "win32" && /^[A-Za-z]:|^\/\//.test(separated)) {
    normalized = win32.normalize(separated).replaceAll("\\", "/")
  }
  if (normalized === "/" || /^[A-Za-z]:\/$/.test(normalized)) {
    return normalized
  }

  return normalized.replace(/\/+$/, "")
}

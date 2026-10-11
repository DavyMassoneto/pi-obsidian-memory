import { posix, win32 } from "node:path"

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
  const path = normalizedPath(vaultPath).replace(/\/+$/, "")
  return path.slice(path.lastIndexOf("/") + 1)
}

export function isInside(folder: string, parent: string): boolean {
  const current = comparablePath(folder)
  const root = comparablePath(parent)
  if (root.endsWith("/")) {
    return current.startsWith(root)
  }

  return current === root || current.startsWith(`${root}/`)
}

export function pathsOverlap(first: string, second: string): boolean {
  return isInside(first, second) || isInside(second, first)
}

function byDeepestFolder(first: ProjectEntry, second: ProjectEntry): number {
  return comparablePath(second.folder).length - comparablePath(first.folder).length
}

export function comparablePath(path: string): string {
  return normalizedPath(path).toLowerCase()
}

function normalizedPath(path: string): string {
  const separated = path.replaceAll("\\", "/")
  let normalized = posix.normalize(separated)
  if (/^[A-Za-z]:|^\/\//.test(separated)) {
    normalized = win32.normalize(separated).replaceAll("\\", "/")
  }
  if (normalized === "/" || /^[A-Za-z]:\/$/.test(normalized)) {
    return normalized
  }

  return normalized.replace(/\/+$/, "")
}

import { stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { isFullyQualifiedPath } from "./fully-qualified-path.ts"
import type { FileIdentityResult, PathIdentitiesResult, PathIdentity } from "./types.ts"
import { isNamespaceVolumeRoot } from "./volume-namespace.ts"

export async function fileIdentity(path: string): Promise<FileIdentityResult> {
  if (!isFullyQualifiedPath(path)) {
    return { succeeded: false, problems: [`${path}: expected a fully qualified absolute path on this platform`] }
  }

  try {
    return { succeeded: true, output: await identityOf(path) }
  } catch (error) {
    return { succeeded: false, problems: [`${path}: ${String(error)}`] }
  }
}

export async function pathIdentities(absolute: string): Promise<PathIdentitiesResult> {
  if (!isFullyQualifiedPath(absolute)) {
    return { succeeded: false, problems: [`${absolute}: expected a fully qualified absolute path on this platform`] }
  }

  const identities: PathIdentity[] = []
  try {
    for (const path of chain(resolve(absolute))) {
      if (await exists(path)) {
        identities.push(await identityOf(path))
      }
    }
  } catch (error) {
    return { succeeded: false, problems: [`${absolute}: ${String(error)}`] }
  }

  if (identities.length === 0) {
    return { succeeded: false, problems: [`${absolute}: no existing ancestor`] }
  }
  return { succeeded: true, output: identities }
}

function chain(path: string): string[] {
  const paths = [path]
  for (let parent = dirname(path); parent !== paths.at(-1); parent = dirname(parent)) {
    paths.push(parent)
  }
  return paths.filter((path) => !isNamespaceVolumeRoot(path))
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return false
    }
    throw error
  }
}

async function identityOf(path: string): Promise<PathIdentity> {
  const stats = await stat(path, { bigint: true })
  return { device: String(stats.dev), inode: String(stats.ino) }
}

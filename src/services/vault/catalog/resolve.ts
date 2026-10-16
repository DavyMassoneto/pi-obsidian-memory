import { realpath, stat } from "node:fs/promises"
import { isAbsolute, join, relative, sep } from "node:path"

import { isSafeCatalogPath } from "#src/domain"
import type { VaultContext } from "#src/services/vault/context"
import { catalogFailure, catalogIoFailure } from "./failures.ts"
import { catalogEntryKind, catalogStat } from "./stat.ts"
import type { CatalogLocation, CatalogResolveResult, CatalogRootResult } from "./types.ts"

export async function resolveCatalogRoot(vault: VaultContext): Promise<CatalogRootResult> {
  try {
    const root = await realpath(vault.path)
    if (!(await stat(root)).isDirectory()) {
      return catalogFailure({
        path: "",
        scope: "directory",
        reason: "not-directory",
        problem: "The vault root is not a directory",
      })
    }
    return { succeeded: true, output: root }
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path: "", scope: "directory" })
    throw error
  }
}

export async function resolveCatalogEntry(location: CatalogLocation): Promise<CatalogResolveResult> {
  if (location.path !== "" && !isSafeCatalogPath(location.path)) {
    return catalogFailure({
      path: location.path,
      scope: "entry",
      reason: "invalid-path",
      problem: "Expected a safe vault-relative path with / separators",
    })
  }
  try {
    const resolved = await resolveComponents(location)
    if (!resolved.succeeded) return resolved
    const stats = await stat(resolved.output)
    return {
      succeeded: true,
      output: {
        absolutePath: resolved.output,
        canonicalPath: relative(location.root, resolved.output).split(sep).join("/"),
        kind: catalogEntryKind(stats),
        stat: catalogStat(stats),
      },
    }
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path: location.path, scope: "entry" })
    throw error
  }
}

async function resolveComponents(location: CatalogLocation): Promise<CatalogRootResult> {
  let current = location.root
  for (const part of location.path.split("/").filter((part) => part !== "")) {
    current = await realpath(join(current, part))
    if (!isCatalogInside(location.root, current)) {
      return catalogFailure({
        path: location.path,
        scope: "entry",
        reason: "outside-vault",
        problem: "The path leads outside the real vault root",
      })
    }
  }
  return { succeeded: true, output: current }
}

export function isCatalogInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)
}

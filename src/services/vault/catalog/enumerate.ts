import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"

import { catalogFileKind, isCatalogHidden, isCatalogNotePath, type VaultEnumerationResult } from "#src/domain"
import type { VaultContext } from "#src/services/vault/context"
import { catalogIoFailure } from "./failures.ts"
import { resolveCatalogEntry, resolveCatalogRoot, resolveListedEntry } from "./resolve.ts"
import type { CatalogResolveResult, CatalogWalk, CatalogWalkRequest } from "./types.ts"
import { visitCatalogEntry } from "./visit.ts"

export async function enumerateVault(vault: VaultContext): Promise<VaultEnumerationResult> {
  return walkVault({ vault, mode: "memory" })
}

export async function walkVault(request: CatalogWalkRequest): Promise<VaultEnumerationResult> {
  const root = await resolveCatalogRoot(request.vault)
  if (!root.succeeded) return root
  const walk: CatalogWalk = {
    ...request,
    root: root.output,
    pending: [""],
    inventory: { entries: [], observedPaths: [], completeDirectories: [], failures: [], aliases: [] },
  }
  while (walk.pending.length > 0) {
    const folder = walk.pending.pop()
    if (typeof folder === "string") await enumerateDirectory(walk, folder)
  }
  walk.inventory.entries.sort((a, b) => a.path.localeCompare(b.path))
  return { succeeded: true, output: walk.inventory }
}

async function enumerateDirectory(walk: CatalogWalk, folder: string): Promise<void> {
  const resolved = await resolveCatalogEntry({ root: walk.root, path: folder })
  if (!resolved.succeeded) {
    walk.inventory.failures.push({ ...resolved, scope: "directory" })
    return
  }
  try {
    const canonicalFolder = resolved.output.canonicalPath === folder
    const entries = await readdir(resolved.output.absolutePath, { withFileTypes: true })
    walk.inventory.completeDirectories.push(folder)
    for (const entry of entries) {
      const path = [folder, entry.name].filter((part) => part !== "").join("/")
      if (skipEntry(walk, path, entry.isDirectory())) continue
      walk.inventory.observedPaths.push(path)
      visitCatalogEntry(walk, path, await resolveListing(walk, path, entry, canonicalFolder))
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    walk.inventory.failures.push(catalogIoFailure(error, { path: folder, scope: "directory" }))
  }
}

async function resolveListing(
  walk: CatalogWalk,
  path: string,
  entry: Dirent,
  canonicalFolder: boolean,
): Promise<CatalogResolveResult> {
  const location = { root: walk.root, path }
  if (canonicalFolder) return resolveListedEntry(location, entry)
  return resolveCatalogEntry(location)
}

function skipEntry(walk: CatalogWalk, path: string, directory: boolean): boolean {
  if (walk.mode === "export") return isCatalogHidden(path) || catalogFileKind(path) === "temporary"
  if (directory) return isCatalogHidden(path)
  return isCatalogHidden(path) && !isCatalogNotePath(path) && catalogFileKind(path) !== "temporary"
}

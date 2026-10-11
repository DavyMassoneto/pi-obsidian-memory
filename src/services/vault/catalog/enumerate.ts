import { readdir } from "node:fs/promises"

import { catalogFileKind, isCatalogHidden, isCatalogNotePath, type VaultEnumerationResult } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { catalogIoFailure } from "./failures.ts"
import { resolveCatalogEntry, resolveCatalogRoot } from "./resolve.ts"
import type { CatalogWalk, CatalogWalkRequest } from "./types.ts"
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
    const entries = await readdir(resolved.output.absolutePath, { withFileTypes: true })
    walk.inventory.completeDirectories.push(folder)
    for (const entry of entries) {
      const path = [folder, entry.name].filter((part) => part !== "").join("/")
      if (skipEntry(walk, path, entry.isDirectory())) continue
      walk.inventory.observedPaths.push(path)
      await visitCatalogEntry(walk, path)
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    walk.inventory.failures.push(catalogIoFailure(error, { path: folder, scope: "directory" }))
  }
}

function skipEntry(walk: CatalogWalk, path: string, directory: boolean): boolean {
  if (walk.mode === "export") return isCatalogHidden(path) || catalogFileKind(path) === "temporary"
  if (directory) return isCatalogHidden(path)
  return isCatalogHidden(path) && !isCatalogNotePath(path) && catalogFileKind(path) !== "temporary"
}

import { isCatalogHidden, isRootTemplate, type VaultFileRequest } from "#src/domain"
import type { VaultContext } from "#src/services/vault/context"
import { catalogFailure } from "./failures.ts"
import { resolveCatalogEntry, resolveCatalogRoot } from "./resolve.ts"
import type { CatalogResolveResult } from "./types.ts"

export async function observeVaultPath(vault: VaultContext, request: VaultFileRequest): Promise<CatalogResolveResult> {
  let path = request.path
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1)
  const root = await resolveCatalogRoot(vault)
  if (!root.succeeded) return root
  const entry = await resolveCatalogEntry({ root: root.output, path })
  if (!entry.succeeded) return entry
  if (request.path.endsWith("/") && entry.output.kind !== "directory") {
    return catalogFailure({
      path: request.path,
      scope: "directory",
      reason: "not-directory",
      problem: "Expected a folder",
    })
  }
  if (entry.output.kind === "directory" && ![path, entry.output.canonicalPath].every(isReadableFolder)) {
    return catalogFailure({
      path: request.path,
      scope: "directory",
      reason: "excluded",
      problem: "This folder is not readable memory",
    })
  }
  return entry
}

function isReadableFolder(path: string): boolean {
  return !isCatalogHidden(path) && !isRootTemplate(path)
}

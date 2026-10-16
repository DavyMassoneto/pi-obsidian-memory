import { join } from "node:path"

import type { VaultCatalogFailure } from "#src/domain"
import { catalogFailure, catalogIoFailure, resolveCatalogEntry } from "#src/services/vault/catalog"
import { publishExclusively } from "#src/services/vault/filesystem"
import type { Done } from "#src/shared"
import { existingAsset } from "./paths.ts"
import type { AssetWriteRequest } from "./types.ts"

export async function createAssetExclusively(request: AssetWriteRequest): Promise<Done | VaultCatalogFailure> {
  const existing = await existingAsset(request)
  if (!existing.succeeded) return existing
  if (existing.output !== "") return preserveAsset(request, existing.output)
  const parent = await resolveCatalogEntry({ root: request.root, path: request.folder })
  if (!parent.succeeded) return parent
  return publishAsset(request, parent.output.absolutePath)
}

async function publishAsset(request: AssetWriteRequest, parent: string): Promise<Done | VaultCatalogFailure> {
  const path = [request.folder, request.name].filter((part) => part !== "").join("/")
  try {
    const written = await publishExclusively(join(parent, request.name), request.content)
    if (!written.succeeded) {
      if (written.reason !== "exists") {
        return { succeeded: false, path, scope: "file", reason: "not-writable", problems: written.problems }
      }
      request.progress.maintenanceProblems.push(...written.problems)
      return preserveAsset(request, path)
    }
    if (written.maintenanceProblems) request.progress.maintenanceProblems.push(...written.maintenanceProblems)
    request.progress.created.push(path)
    return { succeeded: true }
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path, scope: "file" })
    throw error
  }
}

async function preserveAsset(request: AssetWriteRequest, path: string): Promise<Done | VaultCatalogFailure> {
  const resolved = await resolveCatalogEntry({ root: request.root, path })
  if (!resolved.succeeded) return resolved
  if (resolved.output.kind !== "file") {
    return catalogFailure({ path, scope: "file", reason: "not-file", problem: "The asset path is not a regular file" })
  }
  request.progress.preserved.push(path)
  return { succeeded: true }
}

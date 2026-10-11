import { mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"

import { catalogFailure, catalogIoFailure, resolveCatalogEntry } from "#/services/vault/catalog"
import type { AssetLocation, AssetPathResult } from "./types.ts"

export async function existingAsset(location: AssetLocation): Promise<AssetPathResult> {
  const folder = await resolveCatalogEntry({ root: location.root, path: location.folder })
  if (!folder.succeeded) return folder
  try {
    const names = await readdir(folder.output.absolutePath)
    const matches = names.filter((name) => name.toLowerCase() === location.name.toLowerCase())
    if (matches.length > 1) {
      return catalogFailure({
        path: location.folder,
        scope: "entry",
        reason: "invalid-path",
        problem: `Ambiguous asset name: ${location.name}`,
      })
    }
    const name = matches[0]
    if (!name) return { succeeded: true, output: "" }
    return { succeeded: true, output: [location.folder, name].filter((part) => part !== "").join("/") }
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path: location.folder, scope: "directory" })
    throw error
  }
}

export async function ensureTemplateFolder(root: string): Promise<AssetPathResult> {
  const existing = await existingAsset({ root, folder: "", name: "_templates" })
  if (!existing.succeeded) return existing
  if (existing.output !== "") return checkedDirectory(root, existing.output)
  try {
    await mkdir(join(root, "_templates"))
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!("code" in error) || error.code !== "EEXIST") {
      return catalogIoFailure(error, { path: "_templates", scope: "directory" })
    }
  }
  return checkedDirectory(root, "_templates")
}

async function checkedDirectory(root: string, path: string): Promise<AssetPathResult> {
  const resolved = await resolveCatalogEntry({ root, path })
  if (!resolved.succeeded) return resolved
  if (resolved.output.kind !== "directory") {
    return catalogFailure({
      path,
      scope: "directory",
      reason: "not-directory",
      problem: "Templates must be a directory",
    })
  }
  return { succeeded: true, output: path }
}

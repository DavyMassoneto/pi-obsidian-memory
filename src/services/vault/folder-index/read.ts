import { readdir } from "node:fs/promises"

import { catalogFileKind, isCatalogHidden, isRootTemplate } from "#src/domain"
import {
  catalogFailure,
  catalogIoFailure,
  observeVaultPath,
  type ResolvedCatalogEntry,
  readCatalogBytes,
} from "#src/services/vault/catalog"
import type { VaultContext } from "#src/services/vault/context"
import type { FolderIndexPathResult, FolderIndexRequest, FolderIndexResult } from "./types.ts"

export async function readFolderIndex(vault: VaultContext, request: FolderIndexRequest): Promise<FolderIndexResult> {
  const folder = await observeVaultPath(vault, { path: request.folder })
  if (!folder.succeeded) return folder
  if (folder.output.kind !== "directory") {
    return catalogFailure({
      path: request.folder,
      scope: "directory",
      reason: "not-directory",
      problem: "Expected a folder",
    })
  }
  const index = await findFolderIndex(folder.output, request)
  if (!index.succeeded) return index
  return readSelectedIndex(vault, index.output)
}

async function readSelectedIndex(vault: VaultContext, path: string): Promise<FolderIndexResult> {
  const entry = await observeVaultPath(vault, { path })
  if (!entry.succeeded) return entry
  if (!isReadableIndex(entry.output.canonicalPath)) {
    return catalogFailure({
      path,
      scope: "file",
      reason: "excluded",
      problem: "The index target is not a readable folder index",
    })
  }
  const bytes = await readCatalogBytes(vault, { path, expectedStat: entry.output.stat })
  if (!bytes.succeeded) return bytes
  return {
    succeeded: true,
    output: {
      ...bytes.output,
      canonicalPath: entry.output.canonicalPath,
      text: Buffer.from(bytes.output.bytes).toString("utf8"),
    },
  }
}

function isReadableIndex(path: string): boolean {
  return catalogFileKind(path) === "index" && !isCatalogHidden(path) && !isRootTemplate(path)
}

async function findFolderIndex(
  folder: ResolvedCatalogEntry,
  request: FolderIndexRequest,
): Promise<FolderIndexPathResult> {
  try {
    const names = (await readdir(folder.absolutePath)).filter((name) => name.toLowerCase() === "index.md")
    if (names.length > 1) {
      return {
        succeeded: false,
        reason: "ambiguous-index",
        path: request.folder,
        problems: ["Multiple case-variant folder indexes exist; keep exactly one index.md"],
      }
    }
    const name = names[0]
    if (!name) {
      return catalogFailure({
        path: request.folder,
        scope: "directory",
        reason: "not-found",
        problem: "Folder index is missing; this read does not create it",
      })
    }
    let path = name
    if (request.folder !== "") path = `${request.folder.replace(/\/$/, "")}/${name}`
    return { succeeded: true, output: path }
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path: request.folder, scope: "directory" })
    throw error
  }
}

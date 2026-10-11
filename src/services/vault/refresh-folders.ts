import { ARCHIVE_FOLDER, ancestorFolders, type FolderContents, renderFolderIndex } from "#/domain"
import { findFileIgnoringCase, linkStatOf, writeAtomically } from "#/services/vault/filesystem"
import { FOLDER_INDEX_FILE_NAME } from "./constants.ts"
import { listFolder } from "./list.ts"
import { refuseWrite } from "./refusals.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { FolderListing, NamedVaultContext, RefreshResult } from "./types.ts"

export async function refreshFolders(context: NamedVaultContext, folders: string[]): Promise<RefreshResult> {
  const ancestors = new Set(folders.flatMap(ancestorFolders))
  const maintenanceProblems: string[] = []
  try {
    for (const folder of folders) {
      const checked = await resolveFolder(context.path, folder)
      if (!checked.succeeded) return checked
    }
    for (const folder of ancestors) {
      const written = await writeIndex(context, folder)
      if (!written.succeeded) return { ...written, problems: [...written.problems, ...maintenanceProblems] }
      if (written.maintenanceProblems) maintenanceProblems.push(...written.maintenanceProblems)
    }
  } catch (error) {
    if (error instanceof Error) {
      return { succeeded: false, reason: "io-error", problems: [error.message, ...maintenanceProblems] }
    }
    return { succeeded: false, reason: "io-error", problems: ["Index maintenance failed", ...maintenanceProblems] }
  }
  if (maintenanceProblems.length > 0) return { succeeded: true, maintenanceProblems }
  return { succeeded: true }
}

async function writeIndex(context: NamedVaultContext, folder: string): Promise<RefreshResult> {
  const path = await resolveFile(context.path, folder, FOLDER_INDEX_FILE_NAME)
  if (!path.succeeded) return path
  const listing = await listFolder(context.path, folder, context.limits)
  if (!listing.succeeded) return listing
  const contents = await contentsOf(context, folder, listing.output)
  const written = await writeAtomically(path.output, renderFolderIndex(contents))
  if (!written.succeeded) return refuseWrite(folder, "index", written)
  return written
}

async function contentsOf(context: NamedVaultContext, folder: string, listing: FolderListing): Promise<FolderContents> {
  if (folder.length === 0) {
    return { kind: "root", vaultName: context.name, ...listing, hasArchive: await hasArchive(context.path) }
  }
  return { kind: "subject", path: folder, ...listing }
}

async function hasArchive(vault: string): Promise<boolean> {
  const existing = await findFileIgnoringCase(vault, ARCHIVE_FOLDER)
  if (!existing.succeeded) return false
  const resolved = await resolveFolder(vault, existing.output)
  if (!resolved.succeeded) return false
  const stat = await linkStatOf(resolved.output)
  return stat.succeeded && stat.output.isDirectory()
}

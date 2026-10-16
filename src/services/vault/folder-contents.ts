import { ARCHIVE_FOLDER, type FolderContents } from "#/domain"
import type { NamedVaultContext } from "#/services/vault/context"
import { findFileIgnoringCase, linkStatOf } from "#/services/vault/filesystem"
import { resolveFolder } from "./resolve.ts"
import type { FolderListing } from "./types.ts"

export async function contentsOf(
  context: NamedVaultContext,
  folder: string,
  listing: FolderListing,
): Promise<FolderContents> {
  if (folder.length === 0) {
    return { kind: "root", vaultName: context.name, ...listing, hasArchive: await hasArchive(context.path) }
  }
  return { kind: "subject", path: folder, ...listing }
}

async function hasArchive(vault: string): Promise<boolean> {
  const existing = await findFileIgnoringCase(vault, ARCHIVE_FOLDER)
  if (!existing.succeeded) {
    return false
  }

  const resolved = await resolveFolder(vault, existing.output)
  if (!resolved.succeeded) {
    return false
  }

  const stat = await linkStatOf(resolved.output)
  return stat.succeeded && stat.output.isDirectory()
}

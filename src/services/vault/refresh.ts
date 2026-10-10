import {
  ARCHIVE_FOLDER,
  ancestorFolders,
  FOLDER_INDEX_NAME,
  type FolderContents,
  joinVaultPath,
  type NoteLimits,
  renderFolderIndex,
} from "#/domain"
import { NOTE_EXTENSION } from "./constants.ts"
import { findFileIgnoringCase, writeAtomically } from "./files.ts"
import { listFolder } from "./list.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { FolderListing, RefreshResult } from "./types.ts"

export async function refreshIndexes(
  vault: string,
  folder: string,
  vaultName: string,
  limits: NoteLimits,
): Promise<RefreshResult> {
  const checked = await resolveFolder(vault, folder)
  if (!checked.succeeded) {
    return { succeeded: false, problems: checked.problems }
  }

  for (const current of ancestorFolders(folder)) {
    const written = await writeIndex(vault, current, vaultName, limits)
    if (!written.succeeded) {
      return written
    }
  }

  return { succeeded: true }
}

async function writeIndex(
  vault: string,
  folder: string,
  vaultName: string,
  limits: NoteLimits,
): Promise<RefreshResult> {
  const path = await resolveFile(vault, folder, indexFileName())
  if (!path.succeeded) {
    return { succeeded: false, problems: path.problems }
  }

  const listing = await listFolder(vault, folder, limits)
  if (!listing.succeeded) {
    return { succeeded: false, problems: listing.problems }
  }

  const contents = await contentsOf(vault, folder, vaultName, listing.output)
  const written = await writeAtomically(path.output, renderFolderIndex(contents))
  if (!written.succeeded) {
    const problem = `${joinVaultPath(folder, indexFileName())} cannot be written (${written.code})`
    return { succeeded: false, problems: [problem] }
  }

  return { succeeded: true }
}

async function contentsOf(
  vault: string,
  folder: string,
  vaultName: string,
  listing: FolderListing,
): Promise<FolderContents> {
  if (folder.length === 0) {
    const archive = await findFileIgnoringCase(vault, ARCHIVE_FOLDER)
    return { kind: "root", vaultName, ...listing, hasArchive: archive.succeeded }
  }

  return { kind: "subject", path: folder, ...listing }
}

function indexFileName(): string {
  return `${FOLDER_INDEX_NAME}${NOTE_EXTENSION}`
}

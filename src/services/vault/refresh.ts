import { join } from "node:path"

import { type FolderContents, renderFolderIndex } from "#/domain/folder-index"
import { ARCHIVE_FOLDER, ancestorFolders, FOLDER_INDEX_NAME, joinVaultPath } from "#/domain/note"
import { NOTE_EXTENSION } from "./constants.ts"
import { findFileIgnoringCase, writeAtomically } from "./files.ts"
import { listFolder } from "./list.ts"
import type { FolderListing, RefreshResult, WriteResult } from "./types.ts"

export async function refreshIndexes(vault: string, folder: string, vaultName: string): Promise<RefreshResult> {
  for (const current of ancestorFolders(folder)) {
    const written = await writeIndex(vault, current, vaultName)
    if (!written.succeeded) {
      const problem = `${joinVaultPath(current, indexFileName())} cannot be written (${written.code})`
      return { succeeded: false, problems: [problem] }
    }
  }

  return { succeeded: true }
}

async function writeIndex(vault: string, folder: string, vaultName: string): Promise<WriteResult> {
  const listing = await listFolder(vault, folder)
  const contents = await contentsOf(vault, folder, vaultName, listing)

  return writeAtomically(join(vault, folder, indexFileName()), renderFolderIndex(contents))
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

import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { ARCHIVE_FOLDER, FOLDER_INDEX_NAME, TEMPLATES_FOLDER } from "#/domain/note"
import { NOTE_EXTENSION } from "./constants.ts"
import { readNote } from "./read.ts"
import type { FolderListing } from "./types.ts"

export async function listFolder(vault: string, folder: string): Promise<FolderListing> {
  const entries = await readdir(join(vault, folder), { withFileTypes: true })
  const visible = entries.filter((entry) => !entry.name.startsWith("."))

  const subjects = visible.filter((entry) => isSubject(folder, entry)).map((entry) => entry.name)
  const statements = visible.filter(isNoteFile).map((entry) => entry.name.slice(0, -NOTE_EXTENSION.length))

  const listing: FolderListing = { subjects, notes: [], invalid: [] }
  for (const statement of statements) {
    const read = await readNote(vault, folder, statement)
    if (read.succeeded) {
      listing.notes.push(read.output.note)
    } else if (read.reason === "invalid") {
      listing.invalid.push({ statement, problems: read.problems })
    }
  }

  return listing
}

function isSubject(folder: string, entry: Dirent): boolean {
  if (!entry.isDirectory()) {
    return false
  }

  const name = entry.name.toLowerCase()
  const isRoot = folder.length === 0

  return !isRoot || (name !== ARCHIVE_FOLDER && name !== TEMPLATES_FOLDER)
}

function isNoteFile(entry: Dirent): boolean {
  const name = entry.name.toLowerCase()
  return entry.isFile() && name.endsWith(NOTE_EXTENSION) && name !== `${FOLDER_INDEX_NAME}${NOTE_EXTENSION}`
}

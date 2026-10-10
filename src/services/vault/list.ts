import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"

import { ARCHIVE_FOLDER, FOLDER_INDEX_NAME, type NoteLimits, TEMPLATES_FOLDER } from "#/domain"
import { NOTE_EXTENSION } from "./constants.ts"
import { readNote } from "./read.ts"
import { resolveFolder } from "./resolve.ts"
import type { FolderListing, ListResult, ReadNoteResult } from "./types.ts"

export async function listFolder(vault: string, folder: string, limits: NoteLimits): Promise<ListResult> {
  const directory = await resolveFolder(vault, folder)
  if (!directory.succeeded) {
    return directory
  }

  const entries = await readdir(directory.output, { withFileTypes: true })
  const visible = entries.filter((entry) => !entry.name.startsWith("."))

  const subjects = visible.filter((entry) => isSubject(folder, entry)).map((entry) => entry.name)
  const statements = visible.filter(isNoteFile).map((entry) => entry.name.slice(0, -NOTE_EXTENSION.length))

  const listing: FolderListing = { subjects, notes: [], invalid: [] }
  for (const statement of statements) {
    const read = await readNote(vault, folder, statement, limits)
    addToListing(listing, statement, read)
  }

  return { succeeded: true, output: listing }
}

function addToListing(listing: FolderListing, statement: string, read: ReadNoteResult): void {
  if (read.succeeded) {
    listing.notes.push(read.output.note)
    return
  }

  if (read.reason === "invalid" || read.reason === "needs-fixing") {
    listing.invalid.push({ statement, problems: read.problems })
  }
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

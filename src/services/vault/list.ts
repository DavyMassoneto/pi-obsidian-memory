import type { Dirent } from "node:fs"

import { ARCHIVE_FOLDER, joinVaultPath, type NoteLimits, TEMPLATES_FOLDER } from "#/domain"
import { directoryEntriesOf, linkStatOf } from "#/services/vault/filesystem"
import { FOLDER_INDEX_FILE_NAME, NOTE_EXTENSION } from "./constants.ts"
import { readNote } from "./read.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { FolderListing, ListResult, ReadNoteResult } from "./types.ts"

export async function listFolder(vault: string, folder: string, limits: NoteLimits): Promise<ListResult> {
  const directory = await resolveFolder(vault, folder)
  if (!directory.succeeded) return directory
  const entries = await directoryEntriesOf(directory.output)
  if (!entries.succeeded) return entries
  const listing: FolderListing = { subjects: [], notes: [], invalid: [] }
  for (const entry of entries.output) {
    await addEntry(listing, vault, folder, entry, limits)
  }
  return { succeeded: true, output: listing }
}

async function addEntry(
  listing: FolderListing,
  vault: string,
  folder: string,
  entry: Dirent,
  limits: NoteLimits,
): Promise<void> {
  if (entry.isDirectory()) {
    await addSubject(listing, vault, folder, entry.name)
  } else if (entry.isSymbolicLink()) {
    const resolved = await resolveFile(vault, folder, entry.name)
    if (!resolved.succeeded) {
      addEntryProblem(listing, entry.name, resolved.problems)
      return
    }
    const stat = await linkStatOf(resolved.output)
    if (!stat.succeeded) addEntryProblem(listing, entry.name, stat.problems)
    else if (stat.output.isDirectory()) await addSubject(listing, vault, folder, entry.name)
    else if (stat.output.isFile()) await addNote(listing, vault, folder, entry.name, limits)
  } else if (entry.isFile()) {
    await addNote(listing, vault, folder, entry.name, limits)
  }
}

async function addNote(
  listing: FolderListing,
  vault: string,
  folder: string,
  name: string,
  limits: NoteLimits,
): Promise<void> {
  if (!isNoteName(name)) return
  const statement = name.slice(0, -NOTE_EXTENSION.length)
  addToListing(listing, statement, await readNote(vault, folder, statement, limits))
}

function addToListing(listing: FolderListing, statement: string, read: ReadNoteResult): void {
  if (read.succeeded) listing.notes.push(read.output.note)
  else listing.invalid.push({ statement, problems: read.problems })
}

async function addSubject(listing: FolderListing, vault: string, folder: string, name: string): Promise<void> {
  if (name.startsWith(".")) return
  if (folder.length === 0 && [ARCHIVE_FOLDER, TEMPLATES_FOLDER].includes(name.toLowerCase())) return
  const checked = await resolveFolder(vault, joinVaultPath(folder, name))
  if (!checked.succeeded) {
    addFolderProblem(listing, name, checked.problems)
    return
  }
  listing.subjects.push(name)
}

function addEntryProblem(listing: FolderListing, name: string, problems: string[]): void {
  if (isNoteName(name)) listing.invalid.push({ statement: name.slice(0, -NOTE_EXTENSION.length), problems })
  else if (!name.startsWith(".")) addFolderProblem(listing, name, problems)
}

function addFolderProblem(listing: FolderListing, folder: string, problems: string[]): void {
  if (!listing.problemFolders) listing.problemFolders = []
  listing.problemFolders.push({ folder, problems })
}

function isNoteName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(NOTE_EXTENSION) && lower !== FOLDER_INDEX_FILE_NAME
}

import type { Dirent } from "node:fs"

import { ARCHIVE_FOLDER, joinVaultPath, TEMPLATES_FOLDER } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { directoryEntriesOf, linkStatOf } from "#/services/vault/filesystem"
import { FOLDER_INDEX_FILE_NAME, NOTE_EXTENSION } from "./constants.ts"
import { readNote } from "./read.ts"
import { resolveFile, resolveFolder } from "./resolve.ts"
import type { FolderListing, ListResult, ReadNoteResult } from "./types.ts"

export async function listFolder(vault: VaultContext, folder: string): Promise<ListResult> {
  const directory = await resolveFolder(vault.path, folder)
  if (!directory.succeeded) {
    return directory
  }

  const entries = await directoryEntriesOf(directory.output)
  if (!entries.succeeded) {
    return entries
  }

  const listing: FolderListing = { subjects: [], notes: [], invalid: [] }
  for (const entry of entries.output) {
    await addEntry(listing, vault, folder, entry)
  }
  return { succeeded: true, output: listing }
}

async function addEntry(listing: FolderListing, vault: VaultContext, folder: string, entry: Dirent): Promise<void> {
  if (entry.isDirectory()) {
    await addSubject(listing, vault.path, folder, entry.name)
  } else if (entry.isSymbolicLink()) {
    await addLink(listing, vault, folder, entry.name)
  } else if (entry.isFile()) {
    await addNote(listing, vault, folder, entry.name)
  }
}

async function addLink(listing: FolderListing, vault: VaultContext, folder: string, name: string): Promise<void> {
  const resolved = await resolveFile(vault.path, folder, name)
  if (!resolved.succeeded) {
    addEntryProblem(listing, name, resolved.problems)
    return
  }

  const stat = await linkStatOf(resolved.output)
  if (!stat.succeeded) {
    addEntryProblem(listing, name, stat.problems)
  } else if (stat.output.isDirectory()) {
    await addSubject(listing, vault.path, folder, name)
  } else if (stat.output.isFile()) {
    await addNote(listing, vault, folder, name)
  }
}

async function addNote(listing: FolderListing, vault: VaultContext, folder: string, name: string): Promise<void> {
  if (!isNoteName(name)) {
    return
  }

  const statement = name.slice(0, -NOTE_EXTENSION.length)
  addToListing(listing, statement, await readNote(vault, folder, statement))
}

function addToListing(listing: FolderListing, statement: string, read: ReadNoteResult): void {
  if (read.succeeded) {
    listing.notes.push(read.output.note)
  } else {
    listing.invalid.push({ statement, problems: read.problems })
  }
}

async function addSubject(listing: FolderListing, vault: string, folder: string, name: string): Promise<void> {
  if (name.startsWith(".")) {
    return
  }
  if (folder.length === 0 && [ARCHIVE_FOLDER, TEMPLATES_FOLDER].includes(name.toLowerCase())) {
    return
  }

  const checked = await resolveFolder(vault, joinVaultPath(folder, name))
  if (!checked.succeeded) {
    addFolderProblem(listing, name, checked.problems)
    return
  }

  listing.subjects.push(name)
}

function addEntryProblem(listing: FolderListing, name: string, problems: string[]): void {
  if (isNoteName(name)) {
    listing.invalid.push({ statement: name.slice(0, -NOTE_EXTENSION.length), problems })
  } else if (!name.startsWith(".")) {
    addFolderProblem(listing, name, problems)
  }
}

function addFolderProblem(listing: FolderListing, folder: string, problems: string[]): void {
  if (!listing.problemFolders) {
    listing.problemFolders = []
  }
  listing.problemFolders.push({ folder, problems })
}

function isNoteName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(NOTE_EXTENSION) && lower !== FOLDER_INDEX_FILE_NAME
}

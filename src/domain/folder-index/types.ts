import type { Note } from "#src/domain/note"

export interface Titled {
  statement: string
}

export interface InvalidNote {
  statement: string
  problems: string[]
}

export interface ProblemFolder {
  folder: string
  problems: string[]
}

export interface SubjectFolder {
  kind: "subject"
  path: string
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
  problemFolders?: ProblemFolder[]
}

export interface RootFolder {
  kind: "root"
  vaultName: string
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
  hasArchive: boolean
  problemFolders?: ProblemFolder[]
}

export type FolderContents = SubjectFolder | RootFolder

export interface FolderListingFingerprint {
  folder: string
  fingerprint: string | null
}

import type { Note } from "#/domain/note"

export interface Titled {
  statement: string
}

export interface InvalidNote {
  statement: string
  problems: string[]
}

export interface SubjectFolder {
  kind: "subject"
  path: string
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
}

export interface RootFolder {
  kind: "root"
  vaultName: string
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
  hasArchive: boolean
}

export type FolderContents = SubjectFolder | RootFolder

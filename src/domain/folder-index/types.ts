import type { Note } from "#/domain/note"

export interface SubjectFolder {
  kind: "subject"
  path: string
  subjects: string[]
  notes: Note[]
}

export interface RootFolder {
  kind: "root"
  vaultName: string
  subjects: string[]
  notes: Note[]
  hasArchive: boolean
}

export type FolderContents = SubjectFolder | RootFolder

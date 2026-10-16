import type { Note, NoteType } from "#src/domain/note"

export interface NoteChange {
  body: string
  type: NoteType
  dontForget: boolean
}

export interface PlacedNote {
  folder: string
  note: Note
}

export interface Succession {
  archived: PlacedNote
  successor: PlacedNote
}
